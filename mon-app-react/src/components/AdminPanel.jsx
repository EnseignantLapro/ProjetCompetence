import React, { useState } from 'react'
import AdminEleve from './AdminEleve'
import AdminCompetence from './AdminCompetence'
import AdminClasse from './AdminClasse'
import AdminEvaluation from './AdminEvaluation'
import AdminEnseignant from './AdminEnseignant'

function AdminPanel({ classeChoisie, classes, isSuperAdmin = false, isTeacherReferent = false, teacherInfo = null }) {
  const [activeTab, setActiveTab] = useState('competences') // État pour les onglets

  const getClasseName = () => {
    if (!classeChoisie) return 'Aucune classe sélectionnée'
    const classe = classes.find(c => c.id == classeChoisie)
    return classe ? classe.nom : 'Classe introuvable'
  }

  const getClasseObject = () => {
    if (!classeChoisie) return null
    return classes.find(c => c.id == classeChoisie)
  }

  const renderTabButtons = () => (
    <div style={{ 
      display: 'flex', 
      borderBottom: '2px solid #dee2e6', 
      marginBottom: '20px',
      gap: '0'
    }}>
      {[
        { key: 'competences', label: 'Compétences' },
        { key: 'classes', label: 'Classes' },
        { key: 'eleves', label: 'Élèves' },
        { key: 'enseignants', label: 'Enseignants' },
        { key: 'evaluations', label: 'Évaluations' }
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor: activeTab === tab.key ? '#007bff' : '#f8f9fa',
            color: activeTab === tab.key ? 'white' : '#495057',
            cursor: 'pointer',
            borderTopLeftRadius: tab.key === 'competences' ? '8px' : '0',
            borderTopRightRadius: tab.key === 'evaluations' ? '8px' : '0',
            fontWeight: activeTab === tab.key ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )

  return (
    <div style={{ padding: '20px' }}>
      <h1>Administration</h1>
      
      {renderTabButtons()}

      {activeTab === 'competences' && (
        <AdminCompetence />
      )}

      {activeTab === 'classes' && (
        <AdminClasse teacherInfo={teacherInfo} isSuperAdmin={isSuperAdmin} isTeacherReferent={isTeacherReferent} />
      )}

      {activeTab === 'eleves' && (
        <AdminEleve classe={getClasseObject()} />
      )}

      {activeTab === 'enseignants' && (
        <AdminEnseignant 
          isSuperAdmin={isSuperAdmin}
          isTeacherReferent={isTeacherReferent}
          teacherInfo={teacherInfo}
        />
      )}

      {activeTab === 'evaluations' && (
        <AdminEvaluation 
          classeChoisie={classeChoisie} 
          getClasseName={getClasseName} 
        />
      )}
    </div>
  )
}

export default AdminPanel