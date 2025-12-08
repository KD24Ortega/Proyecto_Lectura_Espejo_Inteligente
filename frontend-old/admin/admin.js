const API_URL = 'http://127.0.0.1:8000';

// Verificar autenticación
function checkAuth() {
    const token = localStorage.getItem('admin_token');
    const userId = localStorage.getItem('admin_user_id');
    
    if (!token || !userId) {
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/static/admin/login.html';
        }
    }
}

// Login
document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-message');
    
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('admin_token', data.access_token);
            localStorage.setItem('admin_user_id', data.user.id);
            localStorage.setItem('admin_username', data.user.username);
            window.location.href = '/static/admin/dashboard.html';
        } else {
            errorDiv.textContent = data.detail || 'Error al iniciar sesión';
        }
    } catch (error) {
        errorDiv.textContent = 'Error de conexión';
    }
});

// Cargar dashboard
async function loadDashboard() {
    const userId = localStorage.getItem('admin_user_id');
    const username = localStorage.getItem('admin_username');
    
    document.getElementById('admin-name').textContent = `Hola, ${username}`;
    
    try {
        const response = await fetch(`${API_URL}/admin/dashboard?user_id=${userId}`);
        const data = await response.json();
        
        document.getElementById('total-users').textContent = data.total_users;
        document.getElementById('total-assessments').textContent = data.total_assessments;
        document.getElementById('total-sessions').textContent = data.total_sessions;
        document.getElementById('active-sessions').textContent = data.active_sessions;
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

// Cargar usuarios
async function loadUsers() {
    const userId = localStorage.getItem('admin_user_id');
    const usersDiv = document.getElementById('users-list');
    
    try {
        const response = await fetch(`${API_URL}/admin/users?user_id=${userId}`);
        const users = await response.json();
        
        if (users.length === 0) {
            usersDiv.innerHTML = '<p class="text-center">No hay usuarios registrados</p>';
            return;
        }
        
        usersDiv.innerHTML = users.map(user => `
            <div class="user-card">
                <div>
                    <h3>${user.full_name}</h3>
                    <p>Email: ${user.email || 'N/A'} | Edad: ${user.age || 'N/A'}</p>
                    <p>Evaluaciones: ${user.total_assessments} | Sesiones: ${user.total_sessions}</p>
                </div>
                <div>
                    <button onclick="viewUser(${user.id})" class="btn-primary">Ver</button>
                    <button onclick="deleteUser(${user.id}, '${user.full_name}')" class="btn-danger">Eliminar</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        usersDiv.innerHTML = '<p class="error-message">Error cargando usuarios</p>';
    }
}

// Ver detalles de usuario
async function viewUser(targetUserId) {
    const userId = localStorage.getItem('admin_user_id');
    
    try {
        const response = await fetch(`${API_URL}/admin/user/${targetUserId}?user_id=${userId}`);
        const data = await response.json();
        
        alert(`Usuario: ${data.user.full_name}\nEvaluaciones: ${data.assessments.length}\nSesiones: ${data.sessions.length}`);
    } catch (error) {
        alert('Error cargando detalles');
    }
}

// Eliminar usuario
async function deleteUser(targetUserId, name) {
    if (!confirm(`¿Eliminar a ${name}?`)) return;
    
    const userId = localStorage.getItem('admin_user_id');
    
    try {
        const response = await fetch(`${API_URL}/admin/user/${targetUserId}?user_id=${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Usuario eliminado');
            loadUsers();
        } else {
            alert(data.detail || 'Error eliminando usuario');
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

// Logout
function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user_id');
    localStorage.removeItem('admin_username');
    window.location.href = '/static/admin/login.html';
}