import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from './src/db';
import AddBillScreen from './src/screens/AddBillScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import QueryScreen from './src/screens/QueryScreen';
import LogScreen from './src/screens/LogScreen';
import { primaryColor } from './src/utils';

const Tab = createBottomTabNavigator();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f7f9f5',
    card: '#ffffff',
    text: '#1f2937',
    primary: primaryColor,
  },
};

export default function App() {
  useEffect(() => {
    initDatabase().catch(console.error);
  }, []);

  return (
    <NavigationContainer theme={theme}>
      <StatusBar style="light" backgroundColor={primaryColor} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: primaryColor },
          headerTintColor: '#fff',
          tabBarActiveTintColor: primaryColor,
          tabBarInactiveTintColor: '#999',
          tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e5e7eb' },
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, string> = {
              'Add Bill': 'add-shopping-cart',
              Inventory: 'inventory',
              Query: 'search',
              Log: 'history',
            };
            return <MaterialIcons name={icons[route.name]} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Add Bill" component={AddBillScreen} />
        <Tab.Screen name="Inventory" component={InventoryScreen} />
        <Tab.Screen name="Query" component={QueryScreen} />
        <Tab.Screen name="Log" component={LogScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
