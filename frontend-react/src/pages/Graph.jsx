import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const VisualizacionSaludMental = () => {
  const [vistaActiva, setVistaActiva] = useState('apiladas');

  // Datos extraídos de la tabla
  const estudios = [
    {
      nombre: "Deep learning para depresión en ancianos de China",
      categorias: {
        prediccion: true,
        estudiantes: false,
        aplicaciones: true,
        evaluacion: false,
        comprension: true
      }
    },
    {
      nombre: "Adicción a smartphones - detección y prevención",
      categorias: {
        prediccion: false,
        estudiantes: false,
        aplicaciones: true,
        evaluacion: false,
        comprension: true
      }
    },
    {
      nombre: "Robots de entretenimiento para prevenir depresión",
      categorias: {
        prediccion: true,
        estudiantes: true,
        aplicaciones: true,
        evaluacion: true,
        comprension: true
      }
    },
    {
      nombre: "Usabilidad - Participantes saludables vs Digital Human",
      categorias: {
        prediccion: false,
        estudiantes: false,
        aplicaciones: false,
        evaluacion: false,
        comprension: false
      }
    },
    {
      nombre: "Chatbot de salud mental - CounterQuestionBot",
      categorias: {
        prediccion: false,
        estudiantes: false,
        aplicaciones: true,
        evaluacion: false,
        comprension: true
      }
    },
    {
      nombre: "EEG para clasificación de depresión mayor usando FBSE",
      categorias: {
        prediccion: true,
        estudiantes: false,
        aplicaciones: true,
        evaluacion: false,
        comprension: false
      }
    },
    {
      nombre: "Deep learning contextual para prevenir depresión en jóvenes",
      categorias: {
        prediccion: true,
        estudiantes: false,
        aplicaciones: true,
        evaluacion: false,
        comprension: true
      }
    },
    {
      nombre: "Machine learning para desorden del espectro autista",
      categorias: {
        prediccion: true,
        estudiantes: false,
        aplicaciones: true,
        evaluacion: false,
        comprension: true
      }
    },
    {
      nombre: "EEG-BCI para reconocimiento de emociones",
      categorias: {
        prediccion: false,
        estudiantes: false,
        aplicaciones: true,
        evaluacion: false,
        comprension: false
      }
    },
    {
      nombre: "ML para reducir severidad de depresión con epilepsia",
      categorias: {
        prediccion: true,
        estudiantes: false,
        aplicaciones: true,
        evaluacion: false,
        comprension: false
      }
    },
    {
      nombre: "Estrés académico y físico - modelo multiespectral",
      categorias: {
        prediccion: false,
        estudiantes: false,
        aplicaciones: false,
        evaluacion: true,
        comprension: true
      }
    },
    {
      nombre: "Belief Updating - Síntomas depresivos y sesgos",
      categorias: {
        prediccion: true,
        estudiantes: true,
        aplicaciones: false,
        evaluacion: false,
        comprension: true
      }
    },
    {
      nombre: "Musicoterapia interactiva computarizada",
      categorias: {
        prediccion: true,
        estudiantes: false,
        aplicaciones: true,
        evaluacion: false,
        comprension: true
      }
    },
    {
      nombre: "IA en terapia musical biométrica para ansiedad",
      categorias: {
        prediccion: true,
        estudiantes: true,
        aplicaciones: true,
        evaluacion: true,
        comprension: true
      }
    }
  ];

  // Preparar datos para gráfica de barras apiladas
  const categorias = [
    { key: 'prediccion', nombre: 'Predicción Suicidio', color: '#e63946' },
    { key: 'estudiantes', nombre: 'Estudiantes Universitarios', color: '#f77f00' },
    { key: 'aplicaciones', nombre: 'Aplicaciones Clínicas', color: '#06d6a0' },
    { key: 'evaluacion', nombre: 'Evaluación Psicométrica', color: '#118ab2' },
    { key: 'comprension', nombre: 'Comprensión Psicopatología', color: '#073b4c' }
  ];

  const datosApiladas = categorias.map(cat => ({
    nombre: cat.nombre,
    cantidad: estudios.filter(e => e.categorias[cat.key]).length,
    color: cat.color
  }));

  // Preparar datos para mapa de calor
  const datosCalor = estudios.map((estudio, idx) => ({
    estudio: `E${idx + 1}`,
    nombreCompleto: estudio.nombre,
    ...estudio.categorias
  }));

  // Preparar datos para barras agrupadas
  const datosAgrupadas = [
    {
      categoria: 'Predicción',
      estudios: estudios.filter(e => e.categorias.prediccion).length
    },
    {
      categoria: 'Estudiantes',
      estudios: estudios.filter(e => e.categorias.estudiantes).length
    },
    {
      categoria: 'Aplicaciones',
      estudios: estudios.filter(e => e.categorias.aplicaciones).length
    },
    {
      categoria: 'Evaluación',
      estudios: estudios.filter(e => e.categorias.evaluacion).length
    },
    {
      categoria: 'Comprensión',
      estudios: estudios.filter(e => e.categorias.comprension).length
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      padding: '3rem 2rem',
      fontFamily: "'Crimson Pro', serif"
    }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Space+Mono:wght@400;700&display=swap');
          
          .btn-vista {
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 0.75rem 1.5rem;
            margin: 0 0.5rem;
            cursor: pointer;
            font-family: 'Space Mono', monospace;
            font-size: 0.9rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.3s ease;
            border-radius: 2px;
          }
          
          .btn-vista:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          
          .btn-vista.activo {
            background: linear-gradient(135deg, #e63946 0%, #f77f00 100%);
            border-color: #e63946;
            box-shadow: 0 4px 20px rgba(230, 57, 70, 0.4);
          }
          
          .celda-calor {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-weight: 700;
          }
          
          .celda-calor:hover {
            transform: scale(1.1);
          }
        `}
      </style>

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: 700,
          color: '#fff',
          marginBottom: '1rem',
          textAlign: 'center',
          letterSpacing: '-1px',
          textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
        }}>
          Estudios de Salud Mental y Tecnología
        </h1>

        <p style={{
          fontSize: '1.1rem',
          color: 'rgba(255, 255, 255, 0.7)',
          textAlign: 'center',
          marginBottom: '3rem',
          maxWidth: '700px',
          margin: '0 auto 3rem',
          lineHeight: 1.6
        }}>
          Análisis visual de catorce estudios sobre aplicaciones tecnológicas en salud mental, 
          clasificados según cinco dimensiones clave de investigación
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '3rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <button 
            className={`btn-vista ${vistaActiva === 'apiladas' ? 'activo' : ''}`}
            onClick={() => setVistaActiva('apiladas')}
          >
            Barras Apiladas
          </button>
          <button 
            className={`btn-vista ${vistaActiva === 'calor' ? 'activo' : ''}`}
            onClick={() => setVistaActiva('calor')}
          >
            Mapa de Calor
          </button>
          <button 
            className={`btn-vista ${vistaActiva === 'agrupadas' ? 'activo' : ''}`}
            onClick={() => setVistaActiva('agrupadas')}
          >
            Barras Agrupadas
          </button>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '2.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {vistaActiva === 'apiladas' && (
            <div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 600,
                color: '#fff',
                marginBottom: '2rem',
                fontFamily: "'Space Mono', monospace"
              }}>
                Distribución por Categoría
              </h2>
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '2rem',
                lineHeight: 1.6
              }}>
                Esta visualización muestra cuántos estudios pertenecen a cada categoría de investigación. 
                Las "Aplicaciones Clínicas ICNL" lideran con mayor frecuencia de aparición.
              </p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={datosApiladas} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" stroke="#fff" />
                  <YAxis 
                    type="category" 
                    dataKey="nombre" 
                    stroke="#fff" 
                    width={200}
                    style={{ fontSize: '0.85rem' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      background: 'rgba(0, 0, 0, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="cantidad" radius={[0, 8, 8, 0]}>
                    {datosApiladas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{
                marginTop: '2rem',
                padding: '1.5rem',
                background: 'rgba(6, 214, 160, 0.1)',
                borderRadius: '8px',
                borderLeft: '4px solid #06d6a0'
              }}>
                <p style={{ color: '#fff', lineHeight: 1.6, margin: 0 }}>
                  <strong>Hallazgo clave:</strong> Doce de catorce estudios (85,7%) se enfocan en aplicaciones clínicas, 
                  mientras que solo cuatro estudios (28,6%) incluyen evaluación psicométrica, indicando una brecha 
                  en la validación de instrumentos.
                </p>
              </div>
            </div>
          )}

          {vistaActiva === 'calor' && (
            <div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 600,
                color: '#fff',
                marginBottom: '2rem',
                fontFamily: "'Space Mono', monospace"
              }}>
                Mapa de Calor - Presencia de Características
              </h2>
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '2rem',
                lineHeight: 1.6
              }}>
                Cada fila representa un estudio (E1-E14) y cada columna una categoría. 
                El color indica presencia (verde) o ausencia (rojo oscuro) de la característica.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: '4px'
                }}>
                  <thead>
                    <tr>
                      <th style={{
                        padding: '1rem',
                        color: '#fff',
                        fontFamily: "'Space Mono', monospace",
                        fontSize: '0.85rem',
                        textAlign: 'left',
                        background: 'rgba(255, 255, 255, 0.1)'
                      }}>
                        Estudio
                      </th>
                      {categorias.map(cat => (
                        <th key={cat.key} style={{
                          padding: '1rem',
                          color: '#fff',
                          fontFamily: "'Space Mono', monospace",
                          fontSize: '0.75rem',
                          textAlign: 'center',
                          background: 'rgba(255, 255, 255, 0.1)',
                          minWidth: '120px'
                        }}>
                          {cat.nombre}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datosCalor.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{
                          padding: '0.75rem 1rem',
                          color: '#fff',
                          fontFamily: "'Space Mono', monospace",
                          fontWeight: 700,
                          background: 'rgba(255, 255, 255, 0.05)',
                          fontSize: '0.9rem'
                        }}>
                          {row.estudio}
                        </td>
                        {categorias.map(cat => (
                          <td key={cat.key} style={{
                            padding: 0,
                            background: row[cat.key] ? cat.color : '#2d1b1b',
                            textAlign: 'center'
                          }}>
                            <div className="celda-calor" style={{
                              padding: '1rem',
                              color: '#fff',
                              fontSize: '1.2rem'
                            }}>
                              {row[cat.key] ? '✓' : '✗'}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{
                marginTop: '2rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                {categorias.map(cat => (
                  <div key={cat.key} style={{
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${cat.color}`
                  }}>
                    <div style={{
                      color: cat.color,
                      fontFamily: "'Space Mono', monospace",
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {cat.nombre}
                    </div>
                    <div style={{
                      color: '#fff',
                      fontSize: '1.5rem',
                      fontWeight: 700
                    }}>
                      {estudios.filter(e => e.categorias[cat.key]).length}
                    </div>
                    <div style={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '0.8rem'
                    }}>
                      estudios
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vistaActiva === 'agrupadas' && (
            <div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 600,
                color: '#fff',
                marginBottom: '2rem',
                fontFamily: "'Space Mono', monospace"
              }}>
                Comparación de Frecuencias
              </h2>
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '2rem',
                lineHeight: 1.6
              }}>
                Comparación directa del número de estudios en cada categoría, facilitando 
                la identificación de tendencias y áreas de mayor investigación.
              </p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={datosAgrupadas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="categoria" 
                    stroke="#fff"
                    style={{ fontSize: '0.85rem' }}
                  />
                  <YAxis stroke="#fff" />
                  <Tooltip 
                    contentStyle={{
                      background: 'rgba(0, 0, 0, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="estudios" fill="#06d6a0" radius={[8, 8, 0, 0]}>
                    {datosAgrupadas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={categorias[index].color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{
                marginTop: '2rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem'
              }}>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(230, 57, 70, 0.1)',
                  borderRadius: '8px',
                  borderLeft: '4px solid #e63946'
                }}>
                  <p style={{ color: '#fff', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>
                    <strong>Predicción de Suicidio:</strong> Diez estudios (71,4%) abordan esta dimensión crítica, 
                    reflejando la prioridad en sistemas de alerta temprana.
                  </p>
                </div>
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(247, 127, 0, 0.1)',
                  borderRadius: '8px',
                  borderLeft: '4px solid #f77f00'
                }}>
                  <p style={{ color: '#fff', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>
                    <strong>Estudiantes Universitarios:</strong> Solo cuatro estudios (28,6%) se enfocan en esta 
                    población vulnerable, evidenciando una oportunidad de investigación.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#fff',
            marginBottom: '1rem',
            fontFamily: "'Space Mono', monospace"
          }}>
            Notas Metodológicas
          </h3>
          <ul style={{
            color: 'rgba(255, 255, 255, 0.7)',
            lineHeight: 1.8,
            fontSize: '0.95rem'
          }}>
            <li>Los datos provienen de una tabla de revisión sistemática de catorce estudios sobre tecnología y salud mental</li>
            <li>Cada estudio fue codificado binariamente (presencia/ausencia) en cinco categorías de análisis</li>
            <li>Las visualizaciones permiten identificar patrones, brechas y concentraciones temáticas en la literatura</li>
            <li>No se incluyen ponderaciones por calidad metodológica o tamaño muestral de los estudios originales</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VisualizacionSaludMental;