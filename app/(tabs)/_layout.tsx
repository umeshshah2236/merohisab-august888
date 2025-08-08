import { Tabs, router, usePathname } from "expo-router";
import { Calculator, Settings, BarChart3, ArrowLeft, Home } from "lucide-react-native";
import React, { useRef } from "react";
import { BackHandler, Platform, TouchableOpacity, View, Text, Dimensions } from "react-native";
import { useSafeAreaInsets, SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export default React.memo(function TabLayout() {
  const { t } = useLanguage();
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // IMMEDIATE: Force dark background for calculator/karobar routes to prevent flash
  const isCalculatorOrKarobar = pathname.includes('/calculator') || pathname.includes('/karobar');
  const forceDarkBackground = Platform.OS === 'android' && isCalculatorOrKarobar;
  
  // Memoize expensive calculations to prevent re-computation
  const isCurrentlyOnHomePage = React.useMemo(() => {
    // Treat the Home tab as active for any route within the Home stack
    return pathname.includes('/(tabs)/(home)');
  }, [pathname]);
  
  // Memoize tab bar colors to prevent re-computation
  const tabBarColors = React.useMemo(() => ({
    backgroundColor: isDark ? '#1E3A8A' : (Platform.OS === 'ios' ? '#3B82F6' : '#FFFFFF'), // Blue for iOS, white for Android in light mode
    borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.5)'
  }), [isDark]);
  
  // Hide tab bar on specific pages
  const shouldHideTabBar = React.useMemo(() => {
    // Check if pathname contains any of these route segments
    return pathname.includes('/add-receive-entry') ||
           pathname.includes('/add-give-entry') ||
           pathname.includes('/edit-receive-entry') ||
           pathname.includes('/edit-give-entry') ||
           pathname.includes('/add-customer') ||
           pathname.includes('/customer-form') ||
           pathname.includes('/customer-detail') ||
           pathname.includes('/calculator') ||  // This covers both /calculator and /calculator/results
           pathname.includes('/karobar');       // This covers both /karobar and /karobar/results
  }, [pathname]);

  // Detect phones without built-in navigation buttons
  const hasNavigationButtons = React.useMemo(() => {
    // More aggressive detection - if bottom insets are small (< 20px), treat as no navigation buttons
    // This covers gesture-based navigation and older devices
    return insets.bottom >= 20;
  }, [insets.bottom]);
  
  // Handle hardware back button for ALL users (authenticated and non-authenticated)
  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('Back button pressed. Pathname:', pathname, 'isAuthenticated:', isAuthenticated);
      
      if (isAuthenticated) {
        // Authenticated user flow
        if (pathname === '/(tabs)/(home)/dashboard') {
          // From dashboard (main authenticated page), exit app
          console.log('On authenticated dashboard - allowing app to close');
          return false;
        }
        
        // For authenticated users, prevent going back to public flow
        // Always navigate to dashboard instead of allowing back navigation
        // This ensures users can never go back to calculator/public flow
        console.log('Authenticated user on other page - redirecting to dashboard');
        router.replace('/(tabs)/(home)/dashboard');
        return true; // Prevent default back behavior
      } else {
        // Non-authenticated user flow - check for main home page
        const isOnMainHome = pathname === '/(tabs)/(home)' || 
                            pathname === '/(tabs)/(home)/index' || 
                            pathname === '/(tabs)/(home)/' ||
                            pathname.endsWith('/(tabs)/(home)') ||
                            pathname.endsWith('/(home)') ||
                            (!pathname.includes('/calculator') && !pathname.includes('/karobar') && !pathname.includes('/settings') && pathname.includes('/(home)'));
        
        if (isOnMainHome) {
          // From main home page (non-authenticated), allow app to close
          console.log('On main home page - allowing app to close');
          return false;
        }
        
        // For non-authenticated users, prevent going back to authenticated pages
        // Always navigate to home instead of allowing back navigation to blank pages
        console.log('Non-authenticated user on other page - redirecting to home');
        router.replace('/(tabs)/(home)');
        return true; // Prevent default back behavior
      }
    });

    return () => backHandler.remove();
  }, [pathname, isAuthenticated]);

  // Unified: Always hide native tab bar and render custom overlay tab bar
  const screenWidth = Dimensions.get('window').width;
  const isAndroid = Platform.OS === 'android';
  const iconSize = isAndroid ? 22 : 24; // Smaller icons on Android, same on iOS
  const barHeight = isAndroid ? 56 : 64; // Reduce iOS height as well
  const buttonPaddingVertical = Platform.OS === 'ios' ? 8 : 6; // Decrease iOS padding too

  const CustomTabBar = () => {
    // Keep the tab bar mounted always to avoid re-mount flicker on iOS.
    // When hidden, move it off-screen and disable interactions.
    const isHidden = shouldHideTabBar;
    return (
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: barHeight,
        backgroundColor: tabBarColors.backgroundColor,
        flexDirection: 'row',
        zIndex: 999,
        // Add top margin with super light line
        marginTop: 0.1,
        borderTopWidth: isAndroid ? 0.8 : 0.3,
        borderTopColor: isAndroid
          ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)')
          : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
        paddingTop: isAndroid ? 4 : 0,
        paddingBottom: isAndroid ? 6 : 0,
        elevation: 0,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        // Keep mounted; slide off-screen instantly when hidden (no animation)
        transform: [{ translateY: isHidden ? (barHeight + insets.bottom) : 0 }],
        opacity: isHidden ? 0 : 1,
      }} pointerEvents={isHidden ? 'none' : 'auto'}>
        {/* Home Tab */}
        <TouchableOpacity
          style={{
            flex: 1,
            justifyContent: Platform.OS === 'ios' ? 'flex-end' : 'center',
            alignItems: 'center',
            paddingVertical: buttonPaddingVertical,
            position: 'relative',
            // On Android keep active Home fully opaque so blue color shows clearly
            opacity: isCurrentlyOnHomePage && Platform.OS === 'ios' ? 0.5 : 1,
          }}
          disabled={isCurrentlyOnHomePage}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            if (isAuthenticated) {
              router.replace('/(tabs)/(home)/dashboard');
            } else {
              router.replace('/(tabs)/(home)');
            }
          }}
        >
          {isCurrentlyOnHomePage && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              marginLeft: -15,
              width: 30,
              height: 3,
              backgroundColor: isDark ? '#FFFFFF' : '#3B82F6',
              borderRadius: 2,
            }} />
          )}
          {isAuthenticated ? (
            <Home color={isCurrentlyOnHomePage ? (isDark ? "#FFFFFF" : "#3B82F6") : (isDark ? "#94A3B8" : (Platform.OS === 'ios' ? "#FFFFFF" : "#6B7280"))} strokeWidth={2.5} size={iconSize} />
          ) : (
            // For non-authenticated users, the Home tab shows Calculator icon, keep same active coloring
            <Calculator color={isCurrentlyOnHomePage ? (isDark ? "#FFFFFF" : "#3B82F6") : (isDark ? "#94A3B8" : (Platform.OS === 'ios' ? "#FFFFFF" : "#6B7280"))} strokeWidth={2.5} size={iconSize} />
          )}
          <Text style={{ 
            color: isCurrentlyOnHomePage ? (isDark ? "#FFFFFF" : "#3B82F6") : (isDark ? "#94A3B8" : (Platform.OS === 'ios' ? "#FFFFFF" : "#6B7280")), 
            fontSize: 12, 
            marginTop: 4, 
            fontWeight: 'bold' 
          }}>
            {t('home')}
          </Text>
        </TouchableOpacity>
        
        {/* Settings Tab */}
        <TouchableOpacity
          style={{
            flex: 1,
            justifyContent: Platform.OS === 'ios' ? 'flex-end' : 'center',
            alignItems: 'center',
            paddingVertical: buttonPaddingVertical,
            position: 'relative',
          }}
          onPress={() => {
            if (pathname.includes('/settings')) {
              return;
            }
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            router.replace('/(tabs)/settings');
          }}
        >
          {Platform.OS === 'ios' && pathname.includes('/settings') && (
            <View style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              marginLeft: -15,
              width: 30,
              height: 3,
              backgroundColor: isDark ? '#FFFFFF' : '#3B82F6',
              borderRadius: 2,
            }} />
          )}
          <Settings color={pathname.includes('/settings') ? (isDark ? "#FFFFFF" : (Platform.OS === 'ios' ? "#FFFFFF" : "#3B82F6")) : (isDark ? "#94A3B8" : (Platform.OS === 'ios' ? "#FFFFFF" : "#6B7280"))} strokeWidth={2.5} size={iconSize} />
          <Text style={{ 
            color: pathname.includes('/settings') ? (isDark ? "#FFFFFF" : (Platform.OS === 'ios' ? "#FFFFFF" : "#3B82F6")) : (isDark ? "#94A3B8" : (Platform.OS === 'ios' ? "#FFFFFF" : "#6B7280")), 
            fontSize: 12, 
            marginTop: 4, 
            fontWeight: 'bold' 
          }}>
            {t('settings')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            title: t('home'),
            tabBarLabel: t('home'),
            tabBarIcon: ({ color }) => {
              const iconColor = isCurrentlyOnHomePage ? "#666666" : "#FFFFFF";
              if (isAuthenticated) {
                return <Home color={iconColor} strokeWidth={2.5} />;
              }
              return <Calculator color={iconColor} strokeWidth={2.5} />;
            },
            headerShown: false,
            headerTitle: 'Home',
            headerTitleStyle: {
              fontWeight: 'bold',
            }
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              if (isCurrentlyOnHomePage) {
                return;
              }
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              if (isAuthenticated) {
                router.replace('/(tabs)/(home)/dashboard');
              } else {
                router.replace('/(tabs)/(home)');
              }
            },
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('settings'),
            tabBarIcon: ({ color }) => <Settings color={color} strokeWidth={2.5} />,
            headerShown: false,
            headerTitleStyle: {
              fontWeight: 'bold',
            }
          }}
          listeners={{
            tabPress: (e) => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            },
          }}
        />
      </Tabs>
      <CustomTabBar />
    </View>
  );
});