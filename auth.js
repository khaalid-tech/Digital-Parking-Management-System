const express = require('express');
const bcrypt = require('bcrypt');
const { getDatabase } = require('../database/init');
const { logAudit } = require('../utils/audit');

const router = express.Router();

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else {
      res.redirect('/cashier/dashboard');
    }
  } else {
    res.render('auth/login', { 
      title: 'Login - Digital Parking System',
      error: req.query.error || null
    });
  }
});

// Login process
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.redirect('/auth/login?error=Please provide both username and password');
  }

  try {
    const db = getDatabase();
    
    db.get(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username],
      async (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.redirect('/auth/login?error=System error occurred');
        }

        if (!user) {
          return res.redirect('/auth/login?error=Invalid username or password');
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.redirect('/auth/login?error=Invalid username or password');
        }

        // Set session
        req.session.user = {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          email: user.email
        };

        // Log successful login
        await logAudit(user.id, 'LOGIN', 'users', user.id, null, null, req.ip, req.get('User-Agent'));

        // Redirect based on role
        if (user.role === 'admin') {
          res.redirect('/admin/dashboard');
        } else {
          res.redirect('/cashier/dashboard');
        }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/auth/login?error=System error occurred');
  }
});

// Logout
router.get('/logout', async (req, res) => {
  if (req.session.user) {
    try {
      // Log logout action
      await logAudit(req.session.user.id, 'LOGOUT', 'users', req.session.user.id, null, null, req.ip, req.get('User-Agent'));
    } catch (error) {
      console.error('Error logging logout:', error);
    }
  }
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/auth/login');
  });
});

// Change password page
router.get('/change-password', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  res.render('auth/change-password', {
    title: 'Change Password',
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// Change password process
router.post('/change-password', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  const { current_password, new_password, confirm_password } = req.body;
  
  if (!current_password || !new_password || !confirm_password) {
    return res.redirect('/auth/change-password?error=All fields are required');
  }

  if (new_password !== confirm_password) {
    return res.redirect('/auth/change-password?error=New passwords do not match');
  }

  if (new_password.length < 6) {
    return res.redirect('/auth/change-password?error=New password must be at least 6 characters');
  }

  try {
    const db = getDatabase();
    
    // Get current user with password
    db.get(
      'SELECT * FROM users WHERE id = ?',
      [req.session.user.id],
      async (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.redirect('/auth/change-password?error=System error occurred');
        }

        if (!user) {
          return res.redirect('/auth/change-password?error=User not found');
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(current_password, user.password);
        if (!isValidPassword) {
          return res.redirect('/auth/change-password?error=Current password is incorrect');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        
        // Update password
        db.run(
          'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [hashedPassword, req.session.user.id],
          async function(err) {
            if (err) {
              console.error('Error updating password:', err);
              return res.redirect('/auth/change-password?error=Failed to update password');
            }

            // Log password change
            await logAudit(req.session.user.id, 'PASSWORD_CHANGE', 'users', req.session.user.id, null, null, req.ip, req.get('User-Agent'));

            res.redirect('/auth/change-password?success=Password changed successfully');
          }
        );
      }
    );
  } catch (error) {
    console.error('Change password error:', error);
    res.redirect('/auth/change-password?error=System error occurred');
  }
});

// Forgot password page (basic implementation)
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Forgot Password',
    message: 'Please contact your system administrator to reset your password.'
  });
});

module.exports = router;
