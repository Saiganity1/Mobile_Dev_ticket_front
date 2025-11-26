import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import AdminPanel from './src/screens/AdminPanel';
import MyReportsScreen from './src/screens/MyReportsScreen';
import BubbleSettings from './src/screens/BubbleSettings';
import ReceiptScreen from './src/screens/ReceiptScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from './src/styles';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('authToken');
      setInitialRoute(token ? 'Home' : 'Login');
    })();
  }, []);

  if (!initialRoute) {
    // still loading token; avoid rendering navigator until we know
    return null;
  }

  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Admin" component={AdminPanel} />
          <Stack.Screen name="BubbleSettings" component={BubbleSettings} />
          <Stack.Screen name="Receipt" component={ReceiptScreen} />
          <Stack.Screen name="MyReports" component={MyReportsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
