"use client";

import * as React from "react";

export interface CurrentUserData {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  profile_photo_url?: string;
}

const CurrentUserContext = React.createContext<CurrentUserData | undefined>(
  undefined,
);

export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUserData;
  children: React.ReactNode;
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useServerResolvedCurrentUser() {
  return React.useContext(CurrentUserContext);
}
