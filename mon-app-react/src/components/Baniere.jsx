// components/Baniere.jsx
import '../App.css'

function Baniere({ 
    classes, 
    classeChoisie, 
    onClasseChange, 
    isAdmin, 
    adminVisible, 
    onToggleAdmin,
    isStudentMode = false,
    studentInfo = null,
    onStudentLogout = null,
    isTeacherMode = false,
    teacherInfo = null,
    onTeacherLogout = null,
    hasAdminAccess = false
}) {
    const getClasseName = () => {
        if (!classeChoisie) return ''
        const classe = classes.find(c => c.id == classeChoisie)
        return classe ? classe.nom : ''
    }

    return (
        <div className="baniere-container">
            {/* Overlay pour améliorer la lisibilité du texte */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(248, 249, 250, 0.45)',
                zIndex: 1
            }}></div>
            
            <div 
                className="baniere-content"
                style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    position: 'relative',
                    zIndex: 2
                }}
            >
                <div>
                    <h1 className="baniere-titre">
                        {isStudentMode ? 'Mon bilan de compétences' : 
                         isTeacherMode ? 'Espace Enseignant' :
                         'Evaluation au fil de l\'eau'}
                    </h1>
                    
                    {/* Affichage pour le mode élève */}
                    {isStudentMode && studentInfo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                            <span style={{ fontWeight: '500', color: '#333' }}>
                                Classe : {getClasseName()}
                            </span>
                            <span style={{ color: '#666', fontSize: '14px' }}>
                                • {studentInfo.prenom} {studentInfo.nom}
                            </span>
                        </div>
                    )}

                    {/* Affichage pour le mode enseignant */}
                    {isTeacherMode && teacherInfo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                            <span style={{ fontWeight: '500', color: '#333' }}>
                                {teacherInfo.prenom} {teacherInfo.nom}
                            </span>
                            <span style={{ color: '#666', fontSize: '14px' }}>
                                • {teacherInfo.etablissement} • {teacherInfo.classes?.length || 0} classe(s)
                            </span>
                        </div>
                    )}
                    
                    {/* Masquer le sélecteur de classe en mode élève */}
                    {!isStudentMode && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label htmlFor="select-classe" style={{ fontWeight: '500' }}>
                                Classe :
                            </label>
                            <select 
                                id="select-classe" 
                                value={classeChoisie} 
                                onChange={onClasseChange}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}
                            >
                                <option value="">-- Choisir une classe --</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nom}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Bouton admin en mode normal */}
                {isAdmin && !isStudentMode && !isTeacherMode && (
                    <div>
                        <button 
                            onClick={onToggleAdmin}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: adminVisible ? '#dc3545' : '#e2eaf3ff',
                                color: '#616161ff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '500'
                            }}
                        >
                            {adminVisible ? '← Revenir' : '⚙️ Gérer l\'appli'}
                        </button>
                    </div>
                )}

                {/* Bouton de déconnexion en mode élève */}
                {isStudentMode && studentInfo && onStudentLogout && (
                    <div>
                        <button
                            onClick={onStudentLogout}
                            style={{
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '500'
                            }}
                        >
                            🚪 Déconnexion
                        </button>
                    </div>
                )}

                {/* Boutons en mode enseignant */}
                {isTeacherMode && teacherInfo && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {/* Bouton Gérer l'appli pour les enseignants référents */}
                        {teacherInfo.referent && hasAdminAccess && onToggleAdmin && (
                            <button 
                                onClick={onToggleAdmin}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: adminVisible ? '#dc3545' : '#e2eaf3ff',
                                    color: '#616161ff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                {adminVisible ? '← Revenir' : '⚙️ Gérer l\'appli'}
                            </button>
                        )}
                        
                        {/* Bouton de déconnexion */}
                        {onTeacherLogout && (
                            <button
                                onClick={onTeacherLogout}
                                style={{
                                    backgroundColor: '#8b2c7a',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: '500'
                                }}
                            >
                                👨‍🏫 Déconnexion
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Baniere
