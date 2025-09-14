import React, { useMemo } from 'react'

/**
 * Composant optimisé pour générer les options de devoir dans les select
 * Utilise useMemo pour éviter les re-renders inutiles
 */
const DevoirOptions = React.memo(({ devoirsSansDoublons, keyPrefix = 'devoir' }) => {
    const options = useMemo(() => {
        if (!devoirsSansDoublons || devoirsSansDoublons.length === 0) {
            return []
        }
        
        return devoirsSansDoublons.map((devoir, index) => (
            <option key={`${keyPrefix}-${devoir.devoirKey}-${index}`} value={devoir.devoirKey}>
                {devoir.devoir_label} ({new Date(devoir.date).toLocaleDateString()})
            </option>
        ))
    }, [devoirsSansDoublons, keyPrefix])

    return <>{options}</>
})

DevoirOptions.displayName = 'DevoirOptions'

export default DevoirOptions