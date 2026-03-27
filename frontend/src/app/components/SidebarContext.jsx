import { createContext, useContext, useState } from "react";
const SidebarContext = createContext(null);
export function SidebarProvider({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
    return (<SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      {children}
    </SidebarContext.Provider>);
}
export function useSidebar() {
    const ctx = useContext(SidebarContext);
    if (!ctx)
        throw new Error("useSidebar must be used within SidebarProvider");
    return ctx;
}
