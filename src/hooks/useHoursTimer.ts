import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useAlertSettings } from "./useAlertSettings";

const MINUTES_PER_TICK = 1; // Deduct 1 minute every tick
const TICK_INTERVAL_MS = 60 * 1000; // 1 minute in milliseconds

export interface AlertState {
  showFirstAlert: boolean;
  showSecondAlert: boolean;
  remainingMinutes: number;
  outOfHours: boolean;
}

// Session storage keys to persist alert state across component remounts
const FIRST_ALERT_SHOWN_KEY = 'hours_first_alert_shown';
const SECOND_ALERT_SHOWN_KEY = 'hours_second_alert_shown';

export function useHoursTimer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);
  const { data: alertSettings } = useAlertSettings();
  
  const [alertState, setAlertState] = useState<AlertState>({
    showFirstAlert: false,
    showSecondAlert: false,
    remainingMinutes: 0,
    outOfHours: false
  });

  // Check if alerts were already shown this session
  const wasFirstAlertShown = useCallback(() => {
    return sessionStorage.getItem(FIRST_ALERT_SHOWN_KEY) === 'true';
  }, []);

  const wasSecondAlertShown = useCallback(() => {
    return sessionStorage.getItem(SECOND_ALERT_SHOWN_KEY) === 'true';
  }, []);

  const markFirstAlertShown = useCallback(() => {
    sessionStorage.setItem(FIRST_ALERT_SHOWN_KEY, 'true');
  }, []);

  const markSecondAlertShown = useCallback(() => {
    sessionStorage.setItem(SECOND_ALERT_SHOWN_KEY, 'true');
  }, []);

  const checkAlerts = useCallback((remainingMinutes: number) => {
    // Check if out of hours
    if (remainingMinutes <= 0) {
      setAlertState(prev => ({
        ...prev,
        outOfHours: true,
        remainingMinutes: 0
      }));
      return;
    }
    
    if (!alertSettings) return;

    const firstThreshold = alertSettings.first_alert_minutes;
    const secondThreshold = alertSettings.second_alert_minutes;

    // Check second alert first (more urgent) - only show once per session
    if (remainingMinutes <= secondThreshold && remainingMinutes > 0 && !wasSecondAlertShown()) {
      markSecondAlertShown();
      setAlertState({
        showFirstAlert: false,
        showSecondAlert: true,
        remainingMinutes,
        outOfHours: false
      });
    }
    // Check first alert - only show once per session
    else if (remainingMinutes <= firstThreshold && remainingMinutes > secondThreshold && !wasFirstAlertShown()) {
      markFirstAlertShown();
      setAlertState({
        showFirstAlert: true,
        showSecondAlert: false,
        remainingMinutes,
        outOfHours: false
      });
    }
  }, [alertSettings, wasFirstAlertShown, wasSecondAlertShown, markFirstAlertShown, markSecondAlertShown]);

  const dismissAlert = useCallback(() => {
    setAlertState(prev => ({
      ...prev,
      showFirstAlert: false,
      showSecondAlert: false
    }));
  }, []);

  const deductMinute = useCallback(async () => {
    if (!user) return;

    try {
      // Get current hours
      const { data: currentHours, error: fetchError } = await supabase
        .from('customer_hours')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError || !currentHours) {
        console.log('No hours record found for user');
        return;
      }

      const remainingHours = currentHours.total_hours - currentHours.used_hours;
      const remainingMinutes = remainingHours * 60;
      
      // Check for alerts
      checkAlerts(remainingMinutes);
      
      // Don't deduct if no hours remaining
      if (remainingHours <= 0) {
        console.log('No hours remaining');
        return;
      }

      // Calculate new used_hours (add 1 minute = 1/60 hour)
      const minutesToDeduct = MINUTES_PER_TICK / 60; // Convert minutes to hours
      const newUsedHours = currentHours.used_hours + minutesToDeduct;

      // Update the database
      const { error: updateError } = await supabase
        .from('customer_hours')
        .update({ 
          used_hours: newUsedHours,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating hours:', updateError);
        return;
      }

      lastUpdateRef.current = new Date();
      
      // Invalidate the query to refresh UI
      queryClient.invalidateQueries({ queryKey: ['customer-hours'] });
      
      console.log(`Deducted ${MINUTES_PER_TICK} minute(s). New used_hours: ${newUsedHours}`);
    } catch (error) {
      console.error('Error in deductMinute:', error);
    }
  }, [user, queryClient, checkAlerts]);

  useEffect(() => {
    if (!user) {
      // Clear interval if user logs out
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start the timer
    console.log('Starting hours timer...');
    
    // Check alerts on mount
    const checkInitialAlerts = async () => {
      const { data: currentHours } = await supabase
        .from('customer_hours')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (currentHours) {
        const remainingHours = currentHours.total_hours - currentHours.used_hours;
        checkAlerts(remainingHours * 60);
      }
    };
    checkInitialAlerts();

    // Set up interval to deduct every minute
    intervalRef.current = setInterval(() => {
      deductMinute();
    }, TICK_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, deductMinute, checkAlerts]);

  // Handle visibility change - pause when tab is hidden (optional)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab is hidden - could pause timer here if needed
        console.log('Tab hidden - timer continues');
      } else if (document.visibilityState === 'visible') {
        // Tab is visible again - could sync time here
        console.log('Tab visible - timer continues');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    lastUpdate: lastUpdateRef.current,
    alertState,
    dismissAlert,
  };
}
