// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDrVg2Dkr4vRh_BCsqlVnAONz9XzvfCGCw",
  authDomain: "smart-9ba2a.firebaseapp.com",
  projectId: "smart-9ba2a",
  storageBucket: "smart-9ba2a.firebasestorage.app",
  messagingSenderId: "722281463544",
  appId: "1:722281463544:web:4c26cbd0192a800b80850d",
  measurementId: "G-MKHC4F9Q4W"
};

// Initialize Firebase
let auth;
let db;

try {
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
}

// Track login history
function trackLogin(user) {
  if (!db) return;
  
  db.collection('loginHistory').add({
    userId: user.uid,
    email: user.email,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    action: 'login'
  });
}

// Track door actions
function trackDoorAction(user, action) {
  if (!db) return;
  
  db.collection('doorHistory').add({
    userId: user.uid,
    email: user.email,
    action: action,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Toggle password visibility
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const icon = event.target.closest('button').querySelector('i');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// Validate password strength
function validatePassword(password) {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password)
  };

  // Update UI if we're on the registration page
  const requirementsList = document.querySelectorAll('.password-requirements li');
  if (requirementsList.length > 0) {
    Object.keys(requirements).forEach(req => {
      const li = document.getElementById(req);
      if (li) {
        const icon = li.querySelector('i');
        if (requirements[req]) {
          li.classList.add('valid');
          icon.classList.remove('fa-times');
          icon.classList.add('fa-check');
        } else {
          li.classList.remove('valid');
          icon.classList.remove('fa-check');
          icon.classList.add('fa-times');
        }
      }
    });
  }

  return Object.values(requirements).every(Boolean);
}

// Login function with email verification check
function login() {
  if (!auth) {
    console.error('Firebase Auth not initialized');
    alert('System error: Authentication service not available');
    return;
  }

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      const user = userCredential.user;
      if (!user.emailVerified) {
        throw new Error('Please verify your email before logging in.');
      }
      trackLogin(user);
      
      // Check user role and redirect accordingly
      db.collection('users').doc(user.uid).get()
        .then(doc => {
          if (doc.exists) {
            const userData = doc.data();
            if (userData.role === 'admin') {
              window.location.href = 'admin.html';
            } else {
              window.location.href = 'employee.html';
            }
          } else {
            console.log('User document not found');
            alert('User data not found');
          }
        })
        .catch(error => {
          console.error("Error checking user role: ", error);
          alert("Error checking user role: " + error.message);
        });
    })
    .catch(error => {
      console.error("Error logging in: ", error);
      if (error.message === 'Please verify your email before logging in.') {
        alert(error.message);
      } else {
        alert("Error logging in: " + error.message);
      }
    });
}

// Logout function
function logout() {
  if (!auth) return;
  
  auth.signOut()
    .then(() => {
      window.location.href = 'home.html';
    })
    .catch(error => {
      console.error("Error logging out: ", error);
    });
}

// Register function with improved email verification
function register() {
  if (!auth || !db) {
    console.error('Firebase services not initialized');
    alert('System system: Services not available');
    return;
  }

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const name = document.getElementById('name').value;
  
  if (!email || !password || !confirmPassword || !name) {
    alert('Please fill in all fields');
    return;
  }

  if (password !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }

  if (!validatePassword(password)) {
    alert('Password does not meet all requirements');
    return;
  }

  console.log('Attempting to register user...');
  let createdUser = null;
  
  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      createdUser = userCredential.user;
      console.log('User registered successfully:', createdUser);
      
      // Update user profile with name
      return createdUser.updateProfile({
        displayName: name
      });
    })
    .then(() => {
      // Configure verification email
      const actionCodeSettings = {
        url: window.location.origin + '/home.html',
        handleCodeInApp: true
      };
      
      // Send email verification
      return createdUser.sendEmailVerification(actionCodeSettings);
    })
    .then(() => {
      // Create user document in Firestore
      return db.collection('users').doc(createdUser.uid).set({
        email: createdUser.email,
        name: name,
        role: 'employee',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        emailVerified: false
      }, { merge: true });
    })
    .then(() => {
      console.log('Registration process completed');
      // Sign out the user so they have to verify email first
      return auth.signOut();
    })
    .then(() => {
      alert('Registration successful! Please check your email (including spam folder) to verify your account before logging in.');
      window.location.href = 'home.html';
    })
    .catch(error => {
      console.error("Error during registration:", error);
      let errorMessage = "An error occurred during registration. ";
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage += "This email is already registered.";
          break;
        case 'auth/invalid-email':
          errorMessage += "The email address is invalid.";
          break;
        case 'auth/operation-not-allowed':
          errorMessage += "Email/password accounts are not enabled.";
          break;
        case 'auth/weak-password':
          errorMessage += "The password is too weak.";
          break;
        case 'permission-denied':
          errorMessage += "Please contact an administrator to complete your registration.";
          if (auth.currentUser) {
            auth.currentUser.delete().catch(console.error);
          }
          break;
        default:
          errorMessage += error.message;
      }
      
      alert(errorMessage);
    });
}

// Check if user is admin
function checkAdmin(uid) {
  if (!db) {
    console.error('Firestore not initialized');
    return;
  }
  
  db.collection('users').doc(uid).get()
    .then(doc => {
      if (doc.exists) {
        const userData = doc.data();
        if (userData.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'employee.html';
        }
      } else {
        console.log('User document not found');
        alert('User data not found');
      }
    })
    .catch(error => {
      console.error("Error checking admin: ", error);
      alert("Error checking admin status: " + error.message);
    });
}

// Show tab in admin history
function showTab(tabName) {
  console.log('Showing tab:', tabName);
  // Hide all tabs
  document.querySelectorAll('.history-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Remove active class from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  const selectedTab = document.getElementById(`${tabName}-history`);
  if (selectedTab) {
    selectedTab.style.display = 'block';
  }
  
  // Add active class to clicked button
  if (event && event.target) {
    event.target.classList.add('active');
  }
  
  // Load the appropriate history
  if (tabName === 'login') {
    loadLoginHistory();
  } else {
    loadDoorHistory();
  }
}

// Load login history for admin with user names
function loadLoginHistory() {
  if (!db) return;
  
  db.collection('loginHistory')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get()
    .then(querySnapshot => {
      const historyList = document.getElementById('login-history-list');
      historyList.innerHTML = '';
      
      const promises = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Get user details to show name
        return db.collection('users')
          .where('email', '==', data.email)
          .limit(1)
          .get()
          .then(userSnapshot => {
            const userName = userSnapshot.empty ? data.email : userSnapshot.docs[0].data().name || data.email;
            const time = data.timestamp ? new Date(data.timestamp.toDate()) : new Date();
            const formattedDate = time.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
            const formattedTime = time.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            });
            
            return `
              <div class="history-item">
                <p>User: ${userName}</p>
                <p>Email: ${data.email}</p>
                <p>Date: ${formattedDate}</p>
                <p>Time: ${formattedTime}</p>
              </div>
            `;
          });
      });

      Promise.all(promises)
        .then(historyItems => {
          historyList.innerHTML = historyItems.join('');
        })
        .catch(error => {
          console.error("Error loading user details: ", error);
        });
    })
    .catch(error => {
      console.error("Error loading login history: ", error);
    });
}

// Load door history for admin
function loadDoorHistory() {
  if (!db) return;
  
  db.collection('doorHistory')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get()
    .then(querySnapshot => {
      const historyList = document.getElementById('door-history-list');
      historyList.innerHTML = '';
      
      const promises = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Get user details to show name
        return db.collection('users')
          .where('email', '==', data.email)
          .limit(1)
          .get()
          .then(userSnapshot => {
            const userName = userSnapshot.empty ? 'Unknown User' : userSnapshot.docs[0].data().name || data.email;
            const time = data.timestamp ? new Date(data.timestamp.toDate()) : new Date();
            const formattedDate = time.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
            const formattedTime = time.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            });
            
            return `
              <div class="history-item">
                <p>Action: ${data.action}</p>
                <p>By: ${userName}</p>
                <p>Date: ${formattedDate}</p>
                <p>Time: ${formattedTime}</p>
              </div>
            `;
          });
      });

      Promise.all(promises)
        .then(historyItems => {
          historyList.innerHTML = historyItems.join('');
        })
        .catch(error => {
          console.error("Error loading user details: ", error);
        });
    })
    .catch(error => {
      console.error("Error loading door history: ", error);
    });
}

// Initialize admin panel
function initAdminPanel() {
  const user = auth.currentUser;
  if (!user) {
    auth.onAuthStateChanged(user => {
      if (!user) {
        window.location.href = 'home.html';
        return;
      }
      checkAdminAndInitialize(user);
    });
  } else {
    checkAdminAndInitialize(user);
  }
}

// Check admin status and initialize panel
function checkAdminAndInitialize(user) {
  db.collection('users').doc(user.uid).get()
    .then(doc => {
      if (doc.exists && doc.data().role === 'admin') {
        document.getElementById('admin-panel').style.display = 'block';
        document.getElementById('admin-email').textContent = user.email;
        updateDoorStatus();
      } else {
        window.location.href = 'home.html';
      }
    })
    .catch(error => {
      console.error("Error checking admin status: ", error);
      window.location.href = 'home.html';
    });
}

// Initialize admin history page
function initAdminHistory() {
  console.log('Initializing admin history...');
  // Add loading state
  document.getElementById('admin-history-panel').innerHTML += '<p id="loading">Loading...</p>';
  
  auth.onAuthStateChanged(user => {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
    if (!user) {
      window.location.href = 'home.html';
      return;
    }

    // Check if user is admin
    db.collection('users').doc(user.uid).get()
      .then(doc => {
        console.log('User doc retrieved:', doc.exists);
        if (doc.exists && doc.data().role === 'admin') {
          // Remove loading state
          const loadingEl = document.getElementById('loading');
          if (loadingEl) loadingEl.remove();
          
          // Show panel and initialize
          document.getElementById('admin-history-panel').style.display = 'block';
          document.getElementById('admin-email').textContent = user.email;
          
          // Show login history by default
          document.getElementById('login-history').style.display = 'block';
          document.getElementById('door-history').style.display = 'none';
          loadLoginHistory();
        } else {
          console.log('User is not admin');
          window.location.href = 'home.html';
        }
      })
      .catch(error => {
        console.error("Error checking admin status:", error);
        window.location.href = 'home.html';
      });
  });
}

// Door control function
function controlDoor(action) {
  if (!auth || !db) {
    console.error('Firebase services not initialized');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert('Please login first');
    return;
  }

  // First check if user has permission
  db.collection('users').doc(user.uid).get()
    .then(doc => {
      if (!doc.exists) {
        throw new Error('User not found');
      }
      const userData = doc.data();
      if (userData.role !== 'admin' && userData.role !== 'employee') {
        throw new Error('Unauthorized access');
      }
      
      // User has permission, proceed with door control
      return db.collection('doorStatus').doc('current').set({
        status: action,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: user.email
      });
    })
    .then(() => {
      trackDoorAction(user, action);
      updateDoorStatus();
      alert(`Door ${action} command sent`);
    })
    .catch(error => {
      console.error("Error controlling door: ", error);
      alert("Error controlling door: " + error.message);
    });
}

// Update door status display
function updateDoorStatus() {
  if (!db) return;
  
  db.collection('doorStatus').doc('current').onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('status-text').textContent = data.status;
      document.getElementById('status-text').className = data.status;
    }
  });
}

// Initialize employee page
function initEmployeePage() {
  console.log('Initializing employee page...');
  document.getElementById('employee-panel').style.display = 'none';
  
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'home.html';
      return;
    }

    if (!user.emailVerified) {
      alert('Please verify your email before accessing the system.');
      auth.signOut().then(() => {
        window.location.href = 'home.html';
      });
      return;
    }

    // Get user details from Firestore
    db.collection('users').doc(user.uid).get()
      .then(doc => {
        if (doc.exists) {
          const userData = doc.data();
          if (userData.role !== 'employee') {
            window.location.href = 'home.html';
            return;
          }
          
          // Show the employee panel
          document.getElementById('employee-panel').style.display = 'block';
          // Display user's name
          document.getElementById('user-name').textContent = userData.name || 'Employee';
          // Initialize door status
          updateDoorStatus();
        } else {
          console.error('No user data found');
          window.location.href = 'home.html';
        }
      })
      .catch(error => {
        console.error("Error loading user data:", error);
        window.location.href = 'home.html';
      });
  });
}

// Initialize add user page
function initAddUserPage() {
  console.log('Initializing add user page...');
  document.getElementById('add-user-panel').style.display = 'none';
  
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'home.html';
      return;
    }

    // Check if user is admin
    db.collection('users').doc(user.uid).get()
      .then(doc => {
        if (doc.exists && doc.data().role === 'admin') {
          document.getElementById('add-user-panel').style.display = 'block';
          document.getElementById('admin-email').textContent = user.email;
          
          // Add password validation listener
          const passwordInput = document.getElementById('new-password');
          if (passwordInput) {
            passwordInput.addEventListener('input', function() {
              validatePassword(this.value);
            });
          }
        } else {
          window.location.href = 'home.html';
        }
      })
      .catch(error => {
        console.error("Error checking admin status:", error);
        window.location.href = 'home.html';
      });
  });
}

// Add new user function with name
function addUser() {
  if (!auth || !db) {
    console.error('Firebase services not initialized');
    alert('System error: Services not available');
    return;
  }

  const email = document.getElementById('new-email').value;
  const password = document.getElementById('new-password').value;
  const name = document.getElementById('new-name').value;
  const role = document.getElementById('role').value;
  
  if (!email || !password || !name) {
    alert('Please fill in all fields');
    return;
  }

  if (!validatePassword(password)) {
    alert('Password does not meet all requirements');
    return;
  }

  console.log('Creating new user...');
  
  // Store the current admin user
  const adminUser = auth.currentUser;
  
  // Create a new Firebase Auth instance for the new user
  const secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
  
  secondaryApp.auth().createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      const newUser = userCredential.user;
      console.log('User created successfully:', newUser);
      
      // Update user profile with name
      return newUser.updateProfile({
        displayName: name
      }).then(() => {
        // Send email verification
        return newUser.sendEmailVerification();
      }).then(() => {
        // Save user data to Firestore using the admin's auth
        return db.collection('users').doc(newUser.uid).set({
          email: newUser.email,
          name: name,
          role: role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          emailVerified: false
        });
      });
    })
    .then(() => {
      // Clean up secondary app
      return secondaryApp.delete();
    })
    .then(() => {
      alert(`User ${name} added successfully as ${role}`);
      // Clear the form
      document.getElementById('new-email').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('new-name').value = '';
      document.getElementById('role').value = 'employee';
      
      // Reset password requirements display
      document.querySelectorAll('.password-requirements li').forEach(li => {
        li.classList.remove('valid');
        const icon = li.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-check');
          icon.classList.add('fa-times');
        }
      });
    })
    .catch(error => {
      console.error("Error adding user:", error);
      let errorMessage = "Error adding user: ";
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage += "This email is already registered.";
          break;
        case 'auth/invalid-email':
          errorMessage += "The email address is invalid.";
          break;
        case 'auth/operation-not-allowed':
          errorMessage += "Email/password accounts are not enabled.";
          break;
        case 'auth/weak-password':
          errorMessage += "The password is too weak.";
          break;
        default:
          errorMessage += error.message;
      }
      
      alert(errorMessage);
      
      // Clean up secondary app in case of error
      secondaryApp.delete().catch(console.error);
    });
}

// Add real-time password validation
if (document.getElementById('password')) {
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm-password');
  
  passwordInput.addEventListener('input', function() {
    validatePassword(this.value);
    if (confirmInput.value) {
      if (this.value !== confirmInput.value) {
        confirmInput.setCustomValidity("Passwords don't match");
      } else {
        confirmInput.setCustomValidity('');
      }
    }
  });
  
  if (confirmInput) {
    confirmInput.addEventListener('input', function() {
      if (this.value !== passwordInput.value) {
        this.setCustomValidity("Passwords don't match");
      } else {
        this.setCustomValidity('');
      }
    });
  }
}

// Add this near the top of your app.js file
document.addEventListener('DOMContentLoaded', function() {
  // Set up password toggle buttons
  document.querySelectorAll('.password-container').forEach(container => {
    const input = container.querySelector('input[type="password"]');
    const button = container.querySelector('.show-password');
    
    if (input && button) {
      button.addEventListener('click', function() {
        const icon = this.querySelector('i');
        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      });
    }
  });
});
