import React from 'react'

const AlertDialog = ({ 
    isOpen, 
    title = "Information", 
    message, 
    type = "info", // info, success, warning, error
    okText = "OK",
    onOk 
}) => {
    if (!isOpen) return null

    const getIcon = () => {
        switch (type) {
            case 'success': return '✅'
            case 'warning': return '⚠️'
            case 'error': return '❌'
            case 'info':
            default: return 'ℹ️'
        }
    }

    const getColor = () => {
        switch (type) {
            case 'success': return '#2ecc71'
            case 'warning': return '#f39c12'
            case 'error': return '#e74c3c'
            case 'info':
            default: return '#3498db'
        }
    }

    const handleOk = () => {
        if (onOk) onOk()
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            handleOk()
        }
    }

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}
            onClick={handleBackdropClick}
        >
            <div 
                style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '24px',
                    minWidth: '320px',
                    maxWidth: '500px',
                    maxHeight: '70vh',
                    overflow: 'auto',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                    border: `3px solid ${getColor()}`
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '24px', marginRight: '12px' }}>
                        {getIcon()}
                    </span>
                    <h3 style={{ 
                        margin: 0, 
                        color: getColor(),
                        fontSize: '18px',
                        fontWeight: 'bold'
                    }}>
                        {title}
                    </h3>
                </div>
                
                <div style={{ 
                    marginBottom: '24px', 
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line',
                    color: '#333'
                }}>
                    {message}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleOk}
                        style={{
                            backgroundColor: getColor(),
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            minWidth: '80px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.filter = 'brightness(1.1)'
                        }}
                        onMouseOut={(e) => {
                            e.target.style.filter = 'brightness(1)'
                        }}
                    >
                        {okText}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AlertDialog