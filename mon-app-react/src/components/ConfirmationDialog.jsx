import React from 'react'

/**
 * Composant de dialogue de confirmation personnalisé
 * Remplace les popups JavaScript natives pour une meilleure UX
 */
const ConfirmationDialog = ({ 
    isVisible, 
    onConfirm, 
    onCancel, 
    title, 
    message, 
    confirmText = "Continuer", 
    cancelText = "Annuler",
    type = "warning" // warning, danger, info
}) => {
    if (!isVisible) return null

    const getIconColor = () => {
        switch (type) {
            case 'danger': return '#e74c3c'
            case 'info': return '#3498db'
            case 'warning':
            default: return '#f39c12'
        }
    }

    const getIcon = () => {
        switch (type) {
            case 'danger': return '❌'
            case 'info': return 'ℹ️'
            case 'warning':
            default: return '⚠️'
        }
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                border: `3px solid ${getIconColor()}`
            }}>
                {/* En-tête avec icône */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '16px'
                }}>
                    <span style={{
                        fontSize: '24px',
                        marginRight: '12px'
                    }}>
                        {getIcon()}
                    </span>
                    <h3 style={{
                        margin: 0,
                        color: getIconColor(),
                        fontSize: '18px',
                        fontWeight: 'bold'
                    }}>
                        {title}
                    </h3>
                </div>

                {/* Message */}
                <div style={{
                    marginBottom: '24px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: '#333',
                    whiteSpace: 'pre-line' // Pour permettre les retours à la ligne
                }}>
                    {message}
                </div>

                {/* Boutons */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: '1px solid #ddd',
                            backgroundColor: '#f8f9fa',
                            color: '#333',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.backgroundColor = '#e9ecef'
                        }}
                        onMouseOut={(e) => {
                            e.target.style.backgroundColor = '#f8f9fa'
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: getIconColor(),
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.opacity = '0.9'
                        }}
                        onMouseOut={(e) => {
                            e.target.style.opacity = '1'
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmationDialog