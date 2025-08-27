import React, { createContext, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SavedRSOsContext = createContext();

export const SavedRSOsProvider = ({ children }) => {
    const [savedRSOs, setSavedRSOs] = React.useState([]);
    
    useEffect(() => {
        AsyncStorage.getItem('savedRSOs')
        .then((data) => {
            if (data) {
                setSavedRSOs(JSON.parse(data));
            }
        })
        .catch((error) => {
            console.error('Error loading saved RSOs:', error);
        });
    }
    , []);

    const addRSO = async (rso) => {
        try {
            const updatedRSOs = [...savedRSOs, rso];
            setSavedRSOs(updatedRSOs);
            await AsyncStorage.setItem('savedRSOs', JSON.stringify(updatedRSOs));
        } catch (error) {
            console.error('Error saving RSO:', error);
        }
    }
    const removeRSO = async (rso) => {
        try {
            const updatedRSOs = savedRSOs.filter(item => item !== rso);
            setSavedRSOs(updatedRSOs);
            await AsyncStorage.setItem('savedRSOs', JSON.stringify(updatedRSOs));
        } catch (error) {
            console.error('Error removing RSO:', error);
        }
    }

    const clearRSOs = async () => {
        setSavedRSOs([]);
        await AsyncStorage.removeItem('savedRSOs');
      };
    
    return (
        <SavedRSOsContext.Provider value={{ savedRSOs, addRSO, removeRSO, clearRSOs }}>
        {children}
        </SavedRSOsContext.Provider>
    );
    }