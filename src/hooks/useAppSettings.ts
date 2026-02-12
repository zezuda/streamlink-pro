import { useContext } from 'react';
import { AppSettingsContext } from '../contexts/AppSettingsContext';

export const useAppSettings = () => {
    const context = useContext(AppSettingsContext);
    if (context === undefined) {
        throw new Error('useAppSettings must be used within an AppSettingsProvider');
    }
    return context;
};
