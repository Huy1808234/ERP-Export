'use client'

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getAccessToken } from "@/lib/auth-token";
import { loadCountries } from "@/constants/geo";
import { canReadCountryCatalog, getAccessRoleName } from "@/lib/access-control";

interface IAdminContext {
    collapseMenu: boolean;
    setCollapseMenu: (v: boolean) => void;
}

export const AdminContext = createContext<IAdminContext | null>(null);

export const AdminContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [collapseMenu, setCollapseMenu] = useState(false);
    const { data: session } = useSession();

    useEffect(() => {
        const token = getAccessToken(session);
        const roleName = getAccessRoleName(session?.user);

        if (token && canReadCountryCatalog(roleName)) {
            loadCountries(token);
        }
    }, [session]);

    return (
        <AdminContext.Provider value={{ collapseMenu, setCollapseMenu }}>
            {children}
        </AdminContext.Provider>
    )
};

export const useAdminContext = () => useContext(AdminContext);
