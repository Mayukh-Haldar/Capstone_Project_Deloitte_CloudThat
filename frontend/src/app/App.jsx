import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";
import { router } from "./routes";
import { SidebarProvider } from "./components/SidebarContext";
import { PushNotificationBootstrap } from "./components/PushNotificationBootstrap";
import { Toaster } from "./components/ui/sonner";
export default function App() {
    return (<ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <SidebarProvider>
        <PushNotificationBootstrap />
        <RouterProvider router={router}/>
        <Toaster richColors/>
      </SidebarProvider>
    </ThemeProvider>);
}
