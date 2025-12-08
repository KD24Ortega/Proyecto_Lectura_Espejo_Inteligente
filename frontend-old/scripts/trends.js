const userId = sessionStorage.getItem('user_id');

if (!userId) {
    alert('Debes iniciar sesión primero');
    window.location.href = '/';
}

const API_URL = 'http://localhost:8000';

async function loadTrends() {
    try {
        const response = await fetch(`${API_URL}/trends/analyze/${userId}?days=30`);
        
        if (!response.ok) {
            throw new Error('Error al cargar tendencias');
        }
        
        const data = await response.json();
        
        // Mostrar status
        const statusCard = document.getElementById('status-card');
        statusCard.innerHTML = `
            <h2>Estado General: ${translateStatus(data.overall.status)}</h2>
            <p class="stat-number">${data.overall.multimodal_score.toFixed(1)}/100</p>
        `;
        
        // Gráfico PHQ-9
        if (data.phq9.scores.length > 0) {
            new Chart(document.getElementById('phq9Chart'), {
                type: 'line',
                data: {
                    labels: data.phq9.dates.map(d => new Date(d).toLocaleDateString()),
                    datasets: [{
                        label: 'PHQ-9 (Depresión)',
                        data: data.phq9.scores,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            max: 27,
                            title: { display: true, text: 'Puntuación' }
                        } 
                    }
                }
            });
        }
        
        // Gráfico GAD-7
        if (data.gad7.scores.length > 0) {
            new Chart(document.getElementById('gad7Chart'), {
                type: 'line',
                data: {
                    labels: data.gad7.dates.map(d => new Date(d).toLocaleDateString()),
                    datasets: [{
                        label: 'GAD-7 (Ansiedad)',
                        data: data.gad7.scores,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            max: 21,
                            title: { display: true, text: 'Puntuación' }
                        } 
                    }
                }
            });
        }
        
        // Recomendaciones
        const recsDiv = document.getElementById('recommendations');
        recsDiv.innerHTML = `
            <h3>📊 Tendencia PHQ-9: ${translateTrend(data.phq9.trend)}</h3>
            <h3>📊 Tendencia GAD-7: ${translateTrend(data.gad7.trend)}</h3>
            ${data.phq9.scores.length === 0 ? '<p>⚠️ No hay suficientes evaluaciones PHQ-9 para calcular tendencias</p>' : ''}
            ${data.gad7.scores.length === 0 ? '<p>⚠️ No hay suficientes evaluaciones GAD-7 para calcular tendencias</p>' : ''}
        `;
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('status-card').innerHTML = `
            <p class="error-message">❌ Error al cargar las tendencias. Asegúrate de tener al menos 2 evaluaciones realizadas.</p>
        `;
    }
}

function translateStatus(status) {
    const map = {
        'excellent': '✅ Excelente',
        'good': '👍 Bueno',
        'moderate': '⚠️ Moderado',
        'concerning': '⚠️ Preocupante',
        'critical': '🚨 Crítico'
    };
    return map[status] || status;
}

function translateTrend(trend) {
    const map = {
        'improving': '📈 Mejorando',
        'stable': '➡️ Estable',
        'worsening': '📉 Empeorando'
    };
    return map[trend] || trend;
}

loadTrends();