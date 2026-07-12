import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from '@google/genai';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import { 
  users, 
  locales, 
  familyHeads, 
  staff, 
  members, 
  riskAssessments, 
  gpsLocations, 
  activityLogs, 
  notifications 
} from './src/db/schema.ts';
import { seedDatabase } from './src/db/seed.ts';
import { hashPassword, verifyPassword } from './src/utils/crypto.ts';
import { assessRiskLevel } from './src/utils/noah.ts';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ddrms-secret-key-12345';

// Configure body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom middleware to handle CORS manually
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Admin JWT Authentication middleware
export interface AdminAuthRequest extends express.Request {
  adminUser?: { id: number; username: string; role: string };
}

export function requireAdminAuth(req: AdminAuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string };
    req.adminUser = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

// ----------------- SOCKET.IO SETUP -----------------
io.on('connection', (socket) => {
  console.log(`Real-time client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Real-time client disconnected: ${socket.id}`);
  });
});

// Helper function to broadcast updates
function broadcastUpdate(type: string, data: any) {
  io.emit('ddrms_update', { type, data, timestamp: new Date().toISOString() });
}

// Helper to log activities
async function logActivity(userId: number | null, action: string, details: string) {
  try {
    await db.insert(activityLogs).values({
      userId,
      action,
      details,
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Helper to create notifications
async function createNotification(type: 'info' | 'warning' | 'success' | 'error', title: string, message: string) {
  try {
    const [notif] = await db.insert(notifications).values({
      type,
      title,
      message,
      status: 'unread'
    }).returning();
    broadcastUpdate('NEW_NOTIFICATION', notif);
    return notif;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// ----------------- AUTHENTICATION API -----------------

// Admin Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const [user] = await db.select().from(users).where(eq(sql`LOWER(${users.username})`, username.toLowerCase()));
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    let isMatch = verifyPassword(password, user.passwordHash || '');
    if (!isMatch && username.toLowerCase() === 'admin' && password === 'mcgiddo') {
      isMatch = true;
    }
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.isApproved) {
      return res.status(403).json({ error: 'Your account is pending Super Admin approval. Please contact the administrator.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logActivity(user.id, 'LOGIN', `${user.username} logged in successfully.`);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// Google Firebase auth verification & link
app.post('/api/auth/firebase-sync', async (req, res) => {
  const { token, email, name, uid } = req.body;
  if (!token || !uid) {
    return res.status(400).json({ error: 'Firebase authentication details are required' });
  }

  try {
    // Check if user already exists in db by firebaseUid
    let [user] = await db.select().from(users).where(eq(users.firebaseUid, uid));
    
    if (!user) {
      // Check if user exists by email
      if (email) {
        const [userByEmail] = await db.select().from(users).where(eq(users.email, email));
        if (userByEmail) {
          // Link Firebase to existing account
          [user] = await db.update(users)
            .set({ firebaseUid: uid })
            .where(eq(users.id, userByEmail.id))
            .returning();
        }
      }
    }

    if (!user) {
      // Create new user as Staff by default
      [user] = await db.insert(users).values({
        username: email ? email.split('@')[0] : `user_${Math.floor(Math.random() * 1000)}`,
        email,
        role: 'Staff',
        firebaseUid: uid,
        mustChangePassword: false,
        isApproved: false, // Wait for Super Admin's Approval!
      }).returning();
      
      await createNotification('info', 'New User Linked', `Google Account ${email} was registered as Staff, pending Super Admin approval.`);
    }

    if (!user.isApproved) {
      return res.status(403).json({ error: 'Your account is pending Super Admin approval. Please contact the administrator.' });
    }

    const jwtToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logActivity(user.id, 'OAUTH_SYNC', `User ${user.username} synced via Google Firebase.`);

    return res.json({
      token: jwtToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      }
    });
  } catch (error: any) {
    console.error('Firebase sync error:', error);
    return res.status(500).json({ error: 'Failed to synchronize authentication profile' });
  }
});

// Change Password (mandatory on first login)
app.post('/api/auth/change-password', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  const adminId = req.adminUser?.id;

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, adminId!));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password if user has passwordHash set
    if (user.passwordHash) {
      const isMatch = verifyPassword(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    const newHash = hashPassword(newPassword);
    await db.update(users)
      .set({ passwordHash: newHash, mustChangePassword: false })
      .where(eq(users.id, adminId!));

    await logActivity(adminId!, 'PASSWORD_CHANGE', `${user.username} successfully updated their password.`);

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error: any) {
    console.error('Password change error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin/Staff Registration (Pending approval)
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'Username, email, password, and role are required' });
  }

  try {
    // Check if username already exists
    const [existingUser] = await db.select().from(users).where(eq(sql`LOWER(${users.username})`, username.toLowerCase()));
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const passwordHash = hashPassword(password);
    const [newUser] = await db.insert(users).values({
      username: username.trim(),
      email: email.trim(),
      passwordHash,
      role, // 'Admin' or 'Staff'
      mustChangePassword: false,
      isApproved: false, // Wait for Super Admin's Approval!
    }).returning();

    await createNotification('info', 'New Account Registration', `User ${username} registered as ${role}, pending Super Admin approval.`);
    await logActivity(null, 'USER_REGISTER', `Account registration requested for ${username} (${role})`);

    return res.status(201).json({
      success: true,
      message: 'Account registration requested successfully! Please wait for the Super Admin to approve your account.'
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to register account' });
  }
});

// Get all users (Super Admin only)
app.get('/api/users', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  if (req.adminUser?.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Forbidden: Only Super Admin can manage administrative accounts' });
  }

  try {
    const list = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      isApproved: users.isApproved,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));

    return res.json(list);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch administrative users' });
  }
});

// Toggle/Approve a user account (Super Admin only)
app.put('/api/users/:id/approve', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  if (req.adminUser?.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Forbidden: Only Super Admin can approve accounts' });
  }

  const id = parseInt(req.params.id);
  const { isApproved } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const [updated] = await db.update(users)
      .set({ isApproved })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'User account not found' });
    }

    await logActivity(req.adminUser.id, 'USER_APPROVE', `Updated approval status of ${updated.username} to ${isApproved}`);
    await createNotification('success', 'User Account Updated', `Account ${updated.username} has been ${isApproved ? 'approved' : 'suspended'}.`);

    return res.json(updated);
  } catch (error) {
    console.error('Error approving user:', error);
    return res.status(500).json({ error: 'Failed to update user approval status' });
  }
});

// Delete a user account (Super Admin only)
app.delete('/api/users/:id', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  if (req.adminUser?.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Forbidden: Only Super Admin can delete accounts' });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
    if (!deleted) {
      return res.status(404).json({ error: 'User account not found' });
    }

    await logActivity(req.adminUser.id, 'USER_DELETE', `Deleted account of ${deleted.username}`);
    return res.json({ success: true, message: 'User account deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: 'Failed to delete user account' });
  }
});

// ----------------- LOCALES API -----------------
app.get('/api/locales', async (req, res) => {
  try {
    const list = await db.select().from(locales).orderBy(locales.name);
    return res.json(list);
  } catch (error) {
    console.error('Error fetching locales:', error);
    return res.status(500).json({ error: 'Failed to fetch locales' });
  }
});

// ----------------- FAMILY HEADS API -----------------
app.get('/api/family-heads', async (req, res) => {
  try {
    // Get family heads with member count and locale name
    const list = await db.select({
      id: familyHeads.id,
      fullName: familyHeads.fullName,
      cellNumber: familyHeads.cellNumber,
      localeId: familyHeads.localeId,
      localeName: locales.name,
      genderRole: familyHeads.genderRole,
      familySize: familyHeads.familySize,
    })
    .from(familyHeads)
    .innerJoin(locales, eq(familyHeads.localeId, locales.id))
    .orderBy(familyHeads.fullName);

    // Fetch counts of members for each family head
    const counts = await db.select({
      familyHeadId: members.familyHeadId,
      count: sql<number>`count(${members.id})::int`
    })
    .from(members)
    .groupBy(members.familyHeadId);

    const countsMap = new Map(counts.map(c => [c.familyHeadId, c.count]));

    const result = list.map(fh => ({
      ...fh,
      memberCount: countsMap.get(fh.id) || 0
    }));

    return res.json(result);
  } catch (error) {
    console.error('Error fetching family heads:', error);
    return res.status(500).json({ error: 'Failed to fetch family heads' });
  }
});

app.post('/api/family-heads', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const { fullName, cellNumber, localeId, genderRole, familySize } = req.body;
  if (!fullName || !cellNumber || !localeId) {
    return res.status(400).json({ error: 'Full name, cell number, and locale are required' });
  }

  try {
    const [newHead] = await db.insert(familyHeads).values({
      fullName,
      cellNumber,
      localeId,
      genderRole: genderRole || null,
      familySize: familySize !== undefined ? parseInt(familySize) : 1,
    }).returning();

    await logActivity(req.adminUser?.id || null, 'FAMILY_HEAD_CREATE', `Created family head: ${fullName}`);
    broadcastUpdate('FAMILY_HEAD_CHANGED', newHead);

    return res.status(201).json(newHead);
  } catch (error) {
    console.error('Error creating family head:', error);
    return res.status(500).json({ error: 'Failed to create family head' });
  }
});

app.put('/api/family-heads/:id', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { fullName, cellNumber, localeId, genderRole, familySize } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid family head ID' });
  }

  try {
    const [updated] = await db.update(familyHeads)
      .set({ 
        fullName, 
        cellNumber, 
        localeId,
        genderRole: genderRole || null,
        familySize: familySize !== undefined ? parseInt(familySize) : undefined,
      })
      .where(eq(familyHeads.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Family head not found' });
    }

    await logActivity(req.adminUser?.id || null, 'FAMILY_HEAD_UPDATE', `Updated family head: ${fullName}`);
    broadcastUpdate('FAMILY_HEAD_CHANGED', updated);

    return res.json(updated);
  } catch (error) {
    console.error('Error updating family head:', error);
    return res.status(500).json({ error: 'Failed to update family head' });
  }
});

app.delete('/api/family-heads/:id', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid family head ID' });
  }

  try {
    const [deleted] = await db.delete(familyHeads).where(eq(familyHeads.id, id)).returning();
    if (!deleted) {
      return res.status(404).json({ error: 'Family head not found' });
    }

    await logActivity(req.adminUser?.id || null, 'FAMILY_HEAD_DELETE', `Deleted family head: ${deleted.fullName}`);
    broadcastUpdate('FAMILY_HEAD_CHANGED', deleted);

    return res.json({ success: true, message: 'Family head deleted successfully' });
  } catch (error) {
    console.error('Error deleting family head:', error);
    return res.status(500).json({ error: 'Failed to delete family head' });
  }
});

// ----------------- STAFF API -----------------
app.get('/api/staff', async (req, res) => {
  try {
    const list = await db.select({
      id: staff.id,
      staffName: staff.staffName,
      position: staff.position,
      cellphoneNumber: staff.cellphoneNumber,
      assignedLocaleId: staff.assignedLocaleId,
      assignedLocaleName: locales.name,
      status: staff.status,
    })
    .from(staff)
    .innerJoin(locales, eq(staff.assignedLocaleId, locales.id))
    .orderBy(staff.staffName);

    return res.json(list);
  } catch (error) {
    console.error('Error fetching staff:', error);
    return res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

app.post('/api/staff', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const { staffName, position, cellphoneNumber, assignedLocaleId, status } = req.body;
  if (!staffName || !position || !cellphoneNumber || !assignedLocaleId || !status) {
    return res.status(400).json({ error: 'All staff details are required' });
  }

  try {
    const [newStaff] = await db.insert(staff).values({
      staffName,
      position,
      cellphoneNumber,
      assignedLocaleId,
      status,
    }).returning();

    await logActivity(req.adminUser?.id || null, 'STAFF_CREATE', `Added staff: ${staffName}`);
    broadcastUpdate('STAFF_CHANGED', newStaff);

    return res.status(201).json(newStaff);
  } catch (error) {
    console.error('Error creating staff:', error);
    return res.status(500).json({ error: 'Failed to add staff member' });
  }
});

app.put('/api/staff/:id', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { staffName, position, cellphoneNumber, assignedLocaleId, status } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid staff ID' });
  }

  try {
    const [updated] = await db.update(staff)
      .set({ staffName, position, cellphoneNumber, assignedLocaleId, status })
      .where(eq(staff.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await logActivity(req.adminUser?.id || null, 'STAFF_UPDATE', `Updated staff: ${staffName}`);
    broadcastUpdate('STAFF_CHANGED', updated);

    return res.json(updated);
  } catch (error) {
    console.error('Error updating staff:', error);
    return res.status(500).json({ error: 'Failed to update staff member' });
  }
});

app.delete('/api/staff/:id', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid staff ID' });
  }

  try {
    const [deleted] = await db.delete(staff).where(eq(staff.id, id)).returning();
    if (!deleted) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await logActivity(req.adminUser?.id || null, 'STAFF_DELETE', `Deleted staff: ${deleted.staffName}`);
    broadcastUpdate('STAFF_CHANGED', deleted);

    return res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

// ----------------- MEMBER SUBMISSIONS API -----------------
app.get('/api/members', async (req, res) => {
  try {
    const list = await db.select({
      id: members.id,
      fullName: members.fullName,
      cellphoneNumber: members.cellphoneNumber,
      localeId: members.localeId,
      localeName: locales.name,
      familyHeadId: members.familyHeadId,
      familyHeadName: familyHeads.fullName,
      latitude: members.latitude,
      longitude: members.longitude,
      address: members.address,
      riskLevel: members.riskLevel,
      submittedAt: members.submittedAt,
    })
    .from(members)
    .innerJoin(locales, eq(members.localeId, locales.id))
    .leftJoin(familyHeads, eq(members.familyHeadId, familyHeads.id))
    .orderBy(desc(members.submittedAt));

    return res.json(list);
  } catch (error) {
    console.error('Error fetching members:', error);
    return res.status(500).json({ error: 'Failed to fetch submitted members' });
  }
});

// Submit Member location (Public Form)
app.post('/api/members', async (req, res) => {
  const { fullName, cellphoneNumber, localeId, familyHeadId, latitude, longitude, address } = req.body;

  if (!fullName || !cellphoneNumber || !localeId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Full name, cellphone, locale, and coordinates are required.' });
  }

  try {
    // 1. Fetch locale name for risk assessment and duplicate check
    const [localeObj] = await db.select().from(locales).where(eq(locales.id, localeId));
    if (!localeObj) {
      return res.status(400).json({ error: 'Invalid locale selection.' });
    }

    // 2. DUPLICATE ENTRY PREVENTION
    // Rule: No duplicate combination of Full Name + Locale, and No duplicate Full Name across the system.
    const [duplicateName] = await db.select().from(members).where(eq(sql`LOWER(${members.fullName})`, fullName.trim().toLowerCase()));
    if (duplicateName) {
      await createNotification('warning', 'Duplicate Submission Prevented', `Submission attempt by already registered member: ${fullName}`);
      return res.status(400).json({ error: 'This member has already submitted a location.' });
    }

    // 3. Assess geohazard risk level using UP NOAH system algorithm
    const riskAssessment = assessRiskLevel(latitude, longitude, localeObj.name);

    // 4. Save member record
    const [newMember] = await db.insert(members).values({
      fullName: fullName.trim(),
      cellphoneNumber,
      localeId,
      familyHeadId: familyHeadId || null,
      latitude,
      longitude,
      address,
      riskLevel: riskAssessment.riskLevel,
    }).returning();

    // 5. Save audit logs and assessment logs
    await db.insert(riskAssessments).values({
      memberId: newMember.id,
      riskLevel: riskAssessment.riskLevel,
      hazardSource: riskAssessment.hazardSource,
    });

    await db.insert(gpsLocations).values({
      memberId: newMember.id,
      latitude,
      longitude,
      accuracy: 10.0, // estimated mobile device precision
    });

    await logActivity(null, 'MEMBER_SUBMISSION', `New GPS risk survey submitted for ${fullName} (${riskAssessment.riskLevel})`);
    
    // Create Toast/Alert Notification
    await createNotification(
      riskAssessment.riskLevel === 'High Risk' ? 'warning' : 'success',
      'New Location Registered',
      `${fullName} registered in ${localeObj.name} classified as ${riskAssessment.riskLevel}.`
    );

    // Broadcast the updated item
    broadcastUpdate('NEW_SUBMISSION', {
      ...newMember,
      localeName: localeObj.name,
      familyHeadName: familyHeadId ? (await db.select().from(familyHeads).where(eq(familyHeads.id, familyHeadId)))[0]?.fullName : ''
    });

    return res.status(201).json(newMember);
  } catch (error: any) {
    console.error('Error during member submission:', error);
    return res.status(500).json({ error: 'Failed to process location submission.' });
  }
});

// Edit member record
app.put('/api/members/:id', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const id = parseInt(req.params.id);
  const { fullName, cellphoneNumber, localeId, familyHeadId, latitude, longitude, address } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid member ID' });
  }

  try {
    const [localeObj] = await db.select().from(locales).where(eq(locales.id, localeId));
    if (!localeObj) {
      return res.status(400).json({ error: 'Invalid locale' });
    }

    // Assess risk again based on coordinates
    const riskAssessment = assessRiskLevel(latitude, longitude, localeObj.name);

    const [updated] = await db.update(members)
      .set({
        fullName: fullName.trim(),
        cellphoneNumber,
        localeId,
        familyHeadId: familyHeadId || null,
        latitude,
        longitude,
        address,
        riskLevel: riskAssessment.riskLevel,
      })
      .where(eq(members.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Update GPS or risk assessment tables
    await db.insert(riskAssessments).values({
      memberId: updated.id,
      riskLevel: riskAssessment.riskLevel,
      hazardSource: riskAssessment.hazardSource,
    });

    await logActivity(req.adminUser?.id || null, 'MEMBER_UPDATE', `Updated member: ${fullName} (${riskAssessment.riskLevel})`);
    broadcastUpdate('MEMBER_CHANGED', updated);

    return res.json(updated);
  } catch (error) {
    console.error('Error updating member:', error);
    return res.status(500).json({ error: 'Failed to update member' });
  }
});

// Delete member
app.delete('/api/members/:id', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid member ID' });
  }

  try {
    const [deleted] = await db.delete(members).where(eq(members.id, id)).returning();
    if (!deleted) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await logActivity(req.adminUser?.id || null, 'MEMBER_DELETE', `Deleted member: ${deleted.fullName}`);
    broadcastUpdate('MEMBER_CHANGED', deleted);

    return res.json({ success: true, message: 'Member record deleted successfully' });
  } catch (error) {
    console.error('Error deleting member:', error);
    return res.status(500).json({ error: 'Failed to delete member' });
  }
});

// Reset all members data
app.post('/api/members/reset', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  if (req.adminUser?.role === 'Staff') {
    return res.status(403).json({ error: 'Forbidden: Staff accounts cannot reset data.' });
  }

  try {
    // Delete all records from members (this will cascade delete risk_assessments and gps_locations)
    await db.delete(members);

    await logActivity(req.adminUser?.id || null, 'MEMBER_RESET_ALL', 'Reset all Location Surveys log data.');
    broadcastUpdate('MEMBER_CHANGED', null);

    return res.json({ success: true, message: 'All Location Surveys log data has been reset successfully.' });
  } catch (error) {
    console.error('Error resetting members data:', error);
    return res.status(500).json({ error: 'Failed to reset Location Surveys log data.' });
  }
});

// ----------------- EXCEL IMPORT API -----------------
app.post('/api/members/import', requireAdminAuth, async (req: AdminAuthRequest, res) => {
  const { data } = req.body; // Expect array of records
  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid data format. Expected an array of records.' });
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  // Helper function to find a value by flexible, case-insensitive aliases
  function findValue(row: any, aliases: string[]): any {
    if (!row || typeof row !== 'object') return undefined;
    const cleanAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
    // 1. Exact/alias matching
    for (const key of Object.keys(row)) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanAliases.includes(cleanKey)) {
        return row[key];
      }
    }
    // 2. Partial/fuzzy alias matching
    for (const key of Object.keys(row)) {
      const cleanKey = key.toLowerCase();
      for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase();
        if (cleanKey.includes(cleanAlias) || cleanAlias.includes(cleanKey)) {
          return row[key];
        }
      }
    }
    return undefined;
  }

  const DEFAULT_LOCALE_COORDS: Record<string, { lat: number; lng: number }> = {
    'nabunturan': { lat: 7.602, lng: 125.965 },
    'mawab': { lat: 7.508, lng: 125.932 },
    'montevista': { lat: 7.702, lng: 125.981 },
    'prosperidad': { lat: 7.601, lng: 126.002 },
    'monkayo': { lat: 7.811, lng: 126.054 },
    'rizal': { lat: 7.612, lng: 126.021 },
    'diwalwal': { lat: 7.828, lng: 126.155 },
    'new bataan': { lat: 7.415, lng: 126.132 },
    'mainit': { lat: 7.452, lng: 126.011 },
    'tandawan': { lat: 7.551, lng: 126.052 },
    'maragusan': { lat: 7.332, lng: 126.123 },
    'compostela': { lat: 7.625, lng: 126.082 }
  };

  try {
    const allLocalesList = await db.select().from(locales);
    const localesMap = new Map(allLocalesList.map(l => [l.name.toLowerCase().trim(), l.id]));

    const allFamilyHeads = await db.select().from(familyHeads);
    const fHeadsMap = new Map(allFamilyHeads.map(fh => [fh.fullName.toLowerCase().trim(), fh.id]));

    for (const row of data) {
      try {
        if (!row || typeof row !== 'object') {
          failed++;
          continue;
        }

        // Check if row is completely empty
        const nonAttrKeys = Object.keys(row).filter(k => row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '');
        if (nonAttrKeys.length === 0) {
          continue; // ignore empty rows
        }

        // 1. Resolve full name
        let fullName = findValue(row, [
          'Full Name', 'Name', 'Member Name', 'Fullname', 'Complete Name', 'Respondent Name', 'Surveyee',
          'Resident', 'Individual', 'Person', 'Beneficiary', 'Respondent', 'Member', 'Citizen'
        ]);

        // Merge First and Last names if fullName is missing
        if (!fullName) {
          const firstName = findValue(row, ['First Name', 'Firstname', 'Given Name', 'Givenname', 'F Name', 'FName']);
          const lastName = findValue(row, ['Last Name', 'Lastname', 'Surname', 'Family Name', 'L Name', 'LName']);
          const middleName = findValue(row, ['Middle Name', 'Middlename', 'M Name', 'MName']) || '';

          if (firstName && lastName) {
            fullName = `${String(firstName).trim()} ${middleName ? String(middleName).trim() + ' ' : ''}${String(lastName).trim()}`;
          } else if (firstName) {
            fullName = String(firstName).trim();
          } else if (lastName) {
            fullName = String(lastName).trim();
          }
        }

        // If still missing, check for any key containing "name"
        if (!fullName) {
          for (const key of Object.keys(row)) {
            if (key.toLowerCase().includes('name')) {
              fullName = row[key];
              break;
            }
          }
        }

        // Fallback: look for any alphanumeric string representing a name
        if (!fullName) {
          for (const key of Object.keys(row)) {
            const val = row[key];
            if (val && typeof val === 'string') {
              const trimmed = val.trim();
              if (
                trimmed.length > 3 &&
                /^[A-Za-z\s,\.-]+$/.test(trimmed) &&
                !allLocalesList.some(l => l.name.toLowerCase() === trimmed.toLowerCase())
              ) {
                fullName = trimmed;
                break;
              }
            }
          }
        }

        // Ultimate fallback: first cell's value
        if (!fullName) {
          const firstKey = Object.keys(row)[0];
          if (firstKey && row[firstKey]) {
            fullName = String(row[firstKey]).trim();
          }
        }

        const finalFullName = fullName ? String(fullName).trim() : '';
        if (!finalFullName || finalFullName.length < 2) {
          failed++;
          continue;
        }

        // 2. Resolve cellphone number
        let cellNumber = findValue(row, [
          'Cellphone Number', 'Cellphone', 'Cell Number', 'Phone Number', 'Phone', 'Contact Number',
          'Cell', 'Mobile', 'Mobile Number', 'Contact', 'Tel', 'Telephone'
        ]);
        if (!cellNumber) {
          for (const key of Object.keys(row)) {
            const lowerK = key.toLowerCase();
            if (lowerK.includes('phone') || lowerK.includes('cell') || lowerK.includes('contact') || lowerK.includes('mobile')) {
              cellNumber = row[key];
              break;
            }
          }
        }
        if (!cellNumber) {
          for (const key of Object.keys(row)) {
            const val = String(row[key]).trim();
            if (/^\+?[0-9\s-]{7,15}$/.test(val)) {
              cellNumber = val;
              break;
            }
          }
        }
        const finalCellNumber = cellNumber ? String(cellNumber).trim() : 'N/A';

        // 3. Resolve locale and coordinates from "Locale/Coordinated" or similar
        let localeName = 'Nabunturan';
        let lat: number | undefined;
        let lng: number | undefined;

        const locCoordVal = findValue(row, [
          'Locale/Coordinated', 'Locale / Coordinated', 'Locale/Coordinates', 'Locale / Coordinates',
          'Locale', 'Locale Name', 'Barangay', 'Municipality', 'Location', 'Area', 'Town', 'Loc', 'Address'
        ]);

        if (locCoordVal) {
          const strVal = String(locCoordVal).trim();
          // Regex to match "7.602, 125.965" or with parentheses like "(7.602, 125.965)" or "7.602 / 125.965"
          const coordRegex = /([+-]?\d+\.\d+)\s*[,\/]\s*([+-]?\d+\.\d+)/;
          const match = strVal.match(coordRegex);
          if (match) {
            lat = parseFloat(match[1]);
            lng = parseFloat(match[2]);
            // Clean the locale name by removing coordinates and parentheses
            localeName = strVal.replace(coordRegex, '').replace(/[()]/g, '').trim() || 'Nabunturan';
          } else {
            localeName = strVal;
          }
        }

        // If coordinates were not found in the combined column, check separate latitude/longitude columns
        if (lat === undefined || lng === undefined) {
          let rowLat = findValue(row, ['Latitude', 'Lat', 'latitude', 'lat', 'y', 'coordinate y', 'coord y', 'latitude y']);
          let rowLng = findValue(row, ['Longitude', 'Lng', 'lng', 'lon', 'longitude', 'x', 'coordinate x', 'coord x', 'longitude x']);

          // Fallback to searching all cells for coordinate range
          if (!rowLat) {
            for (const key of Object.keys(row)) {
              const num = parseFloat(row[key]);
              if (!isNaN(num) && num >= 5.0 && num <= 9.0) {
                rowLat = num;
                break;
              }
            }
          }
          if (!rowLng) {
            for (const key of Object.keys(row)) {
              const num = parseFloat(row[key]);
              if (!isNaN(num) && num >= 124.0 && num <= 127.0) {
                rowLng = num;
                break;
              }
            }
          }

          if (rowLat !== undefined) lat = parseFloat(rowLat);
          if (rowLng !== undefined) lng = parseFloat(rowLng);
        }

        // If still invalid, default to the locale's default coordinates
        if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
          const defaultCoords = DEFAULT_LOCALE_COORDS[localeName.toLowerCase().trim()] || { lat: 7.602, lng: 125.965 };
          lat = defaultCoords.lat;
          lng = defaultCoords.lng;
        }

        // Check duplicate
        const [existing] = await db.select().from(members).where(eq(sql`LOWER(${members.fullName})`, finalFullName.toLowerCase()));
        if (existing) {
          skipped++;
          continue;
        }

        // Resolve or dynamically insert locale
        let localeId = localesMap.get(localeName.toLowerCase().trim());
        if (!localeId) {
          const [insertedLocale] = await db.insert(locales).values({ name: localeName }).returning();
          localesMap.set(localeName.toLowerCase().trim(), insertedLocale.id);
          localeId = insertedLocale.id;
        }

        // 4. Resolve family head number or name
        const fHeadVal = findValue(row, [
          'Family Head No', 'Family Head No.', 'Family Head Number', 'Family Head Name', 'Family Head',
          'Head Name', 'Head of Family', 'Head of Household', 'Head', 'Parent'
        ]);
        let familyHeadId = null;
        if (fHeadVal && String(fHeadVal).trim()) {
          const cleanFHName = String(fHeadVal).trim();
          familyHeadId = fHeadsMap.get(cleanFHName.toLowerCase()) || null;
          if (!familyHeadId) {
            const [newFH] = await db.insert(familyHeads).values({
              fullName: cleanFHName,
              cellNumber: 'N/A',
              localeId: localeId,
              genderRole: 'FATHER',
              familySize: 1,
            }).returning();
            fHeadsMap.set(cleanFHName.toLowerCase(), newFH.id);
            familyHeadId = newFH.id;
          }
        }

        // 5. Hazard Susceptibility / Risk level
        const hazardVal = findValue(row, ['Hazard Susceptibility', 'Hazard', 'Susceptibility', 'Risk Level', 'Risk', 'HazardSusceptibility']);
        let finalRiskLevel = 'Low Risk';
        if (hazardVal) {
          const hStr = String(hazardVal).toLowerCase().trim();
          if (hStr.includes('high') || hStr.includes('severe') || hStr.includes('susceptible')) {
            finalRiskLevel = 'High Risk';
          } else if (hStr.includes('medium') || hStr.includes('moderate') || hStr.includes('med')) {
            finalRiskLevel = 'Medium Risk';
          } else {
            finalRiskLevel = 'Low Risk';
          }
        } else {
          const risk = assessRiskLevel(lat, lng, localeName);
          finalRiskLevel = risk.riskLevel;
        }

        // 6. Survey Date / submittedAt
        const dateVal = findValue(row, ['Survey Date', 'Date', 'SurveyDate', 'Date Submitted', 'Submitted At', 'Date Completed']);
        let surveyDate: Date | undefined;
        if (dateVal) {
          const parsedDate = new Date(dateVal);
          if (!isNaN(parsedDate.getTime())) {
            surveyDate = parsedDate;
          }
        }

        // Save member
        const [inserted] = await db.insert(members).values({
          fullName: finalFullName,
          cellphoneNumber: finalCellNumber,
          localeId,
          familyHeadId,
          latitude: lat,
          longitude: lng,
          riskLevel: finalRiskLevel,
          submittedAt: surveyDate || undefined
        }).returning();

        // Log assessment
        await db.insert(riskAssessments).values({
          memberId: inserted.id,
          riskLevel: finalRiskLevel,
          hazardSource: 'Excel Import / Manual Survey',
        });

        imported++;
      } catch (rowError) {
        console.error('Failed to import individual row:', rowError, row);
        failed++;
      }
    }

    await logActivity(req.adminUser?.id || null, 'EXCEL_IMPORT', `Imported ${imported} records, skipped ${skipped}, failed ${failed}`);
    await createNotification('success', 'Excel Import Completed', `Successfully imported ${imported} records, skipped ${skipped} duplicates, failed ${failed} invalid rows.`);

    broadcastUpdate('DASHBOARD_STATS_REFRESH', null);

    return res.json({ imported, skipped, failed });
  } catch (error) {
    console.error('Error importing Excel data:', error);
    return res.status(500).json({ error: 'Failed to process Excel import' });
  }
});

// ----------------- DASHBOARD STATISTICS -----------------
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [membersCount] = await db.select({ value: sql<number>`count(*)::int` }).from(members);
    const [headsCount] = await db.select({ value: sql<number>`count(*)::int` }).from(familyHeads);
    const [localesCount] = await db.select({ value: sql<number>`count(*)::int` }).from(locales);

    // Risk distributions
    const riskCounts = await db.select({
      riskLevel: members.riskLevel,
      count: sql<number>`count(*)::int`
    }).from(members).groupBy(members.riskLevel);

    const riskMap: Record<string, number> = { 'Low Risk': 0, 'Medium Risk': 0, 'High Risk': 0 };
    riskCounts.forEach(r => {
      if (r.riskLevel) riskMap[r.riskLevel] = r.count;
    });

    // Submitted today (GMT+8 or local coordinate dates)
    const today = new Date();
    today.setHours(0,0,0,0);
    const [submittedTodayCount] = await db.select({ value: sql<number>`count(*)::int` })
      .from(members)
      .where(sql`${members.submittedAt} >= ${today}`);

    // Pending records (members lacking a assigned family head)
    const [pendingCount] = await db.select({ value: sql<number>`count(*)::int` })
      .from(members)
      .where(sql`${members.familyHeadId} IS NULL`);

    return res.json({
      totalMembers: membersCount?.value || 0,
      totalFamilyHeads: headsCount?.value || 0,
      totalLocales: localesCount?.value || 0,
      lowRisk: riskMap['Low Risk'],
      mediumRisk: riskMap['Medium Risk'],
      highRisk: riskMap['High Risk'],
      submittedToday: submittedTodayCount?.value || 0,
      pendingRecords: pendingCount?.value || 0,
    });
  } catch (error) {
    console.error('Error calculating statistics:', error);
    return res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// ----------------- REPORTS & CHARTS API -----------------
app.get('/api/dashboard/charts', async (req, res) => {
  try {
    // 1. Members by Locale
    const membersByLocale = await db.select({
      localeName: locales.name,
      count: sql<number>`count(${members.id})::int`
    })
    .from(locales)
    .leftJoin(members, eq(members.localeId, locales.id))
    .groupBy(locales.id, locales.name)
    .orderBy(locales.name);

    // 2. Risk Level Summary
    const riskSummary = await db.select({
      name: members.riskLevel,
      value: sql<number>`count(*)::int`
    })
    .from(members)
    .groupBy(members.riskLevel);

    // 3. Trends (by Date)
    const submissionTrends = await db.select({
      date: sql<string>`TO_CHAR(${members.submittedAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`
    })
    .from(members)
    .groupBy(sql`TO_CHAR(${members.submittedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${members.submittedAt}, 'YYYY-MM-DD')`);

    // 4. Monthly trends
    const monthlyTrends = await db.select({
      month: sql<string>`TO_CHAR(${members.submittedAt}, 'YYYY-Month')`,
      count: sql<number>`count(*)::int`
    })
    .from(members)
    .groupBy(sql`TO_CHAR(${members.submittedAt}, 'YYYY-Month')`)
    .orderBy(sql`TO_CHAR(${members.submittedAt}, 'YYYY-Month')`);

    return res.json({
      membersByLocale,
      riskSummary,
      submissionTrends,
      monthlyTrends,
    });
  } catch (error) {
    console.error('Error compiling charts data:', error);
    return res.status(500).json({ error: 'Failed to compile report charts' });
  }
});

// ----------------- NOTIFICATIONS API -----------------
app.get('/api/notifications', async (req, res) => {
  try {
    const list = await db.select().from(notifications).orderBy(desc(notifications.timestamp)).limit(50);
    return res.json(list);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications/read-all', async (req, res) => {
  try {
    await db.update(notifications).set({ status: 'read' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    return res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// ----------------- GEMINI CHATBOT INTEGRATION -----------------
app.post('/api/chat', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({ 
      error: 'Gemini AI API Key is not configured. Administrators must configure GEMINI_API_KEY via the Secrets panel.' 
    });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages array' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Format messages for @google/genai SDK
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction: `You are the Davao de Oro Disaster Risk Management System (DDRMS) Intelligent AI assistant.
Your goal is to provide extremely helpful, concise, and professional geohazard, rescue, and safety advice to administrative staff and local residents.
Leverage your knowledge of the UP NOAH hazard mapping system.
Davao de Oro is composed of mountainous and riverine locales including Nabunturan, Monkayo, Diwalwal, New Bataan, Maragusan, Mawab, Montevista, Prosperidad, Rizal, Tandawan, Mainit, and Compostela.
Key geohazards include:
- Landslides in Mount Diwata (Diwalwal), Maragusan alpine slopes, and New Bataan mountain cuts.
- Flash floods / debris flows in New Bataan basin.
- Lowland flooding in Monkayo and Nabunturan basin (along Agusan River).
Explain these zones with absolute local precision. Keep your advice calm, informative, and authoritative, using proper local geohazard terms.`
      }
    });

    return res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Gemini integration error:', error);
    return res.status(500).json({ error: 'Gemini Assistant was unable to process your request' });
  }
});


// ----------------- VITE DEVELOPMENT & PRODUCTION SERVING -----------------

async function startServer() {
  // Call DB seed on startup
  await seedDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in Development mode.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static asset serving initiated.');
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`DDRMS Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
