// NOTE: Do not modify the import order unless absolutely necessary.
import { createRoot } from "react-dom/client"
import { RouterProvider, createBrowserRouter } from "react-router-dom"

import "./index.css"

import { AuthProvider } from "./hooks/useAuth"
import { NotificationProvider } from "./hooks/useNotfication"
import { ServerProvider } from "./hooks/useServer"

import Root from "./routes/root"
import ErrorPage from "./error-page"

import ProtectedRoute from "./routes/protect"
import LoginPage from "./routes/login"
import ServerPage from "./routes/server"
import ServicePage from "./routes/service"
import AlertRulePage from "./routes/alert-rule"
import NotificationPage from "./routes/notification"
import ProfilePage from "./routes/profile"
import SettingsPage from "./routes/settings"

const router = createBrowserRouter([
    {
        path: "/dashboard",
        element: (
            <AuthProvider>
                <ProtectedRoute>
                    <Root />
                </ProtectedRoute>
            </AuthProvider>
        ),
        errorElement: <ErrorPage />,
        children: [
            {
                path: "/dashboard/login",
                element: <LoginPage />,
            },
            {
                path: "/dashboard",
                element: (
                    <ServerProvider>
                        <ServerPage />
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/service",
                element: (
                    <ServerProvider withServer>
                        <NotificationProvider>
                            <ServicePage />
                        </NotificationProvider>
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/alert-rule",
                element: (
                    <NotificationProvider withNotifier>
                        <AlertRulePage />
                    </NotificationProvider>
                ),
            },
            {
                path: "/dashboard/notification",
                element: (
                    <NotificationProvider withNotifier>
                        <NotificationPage />
                    </NotificationProvider>
                ),
            },
            {
                path: "/dashboard/profile",
                element: (
                    <ServerProvider withServer>
                        <ProfilePage />
                    </ServerProvider>
                ),
            },
            {
                path: "/dashboard/settings",
                element: (
                    <NotificationProvider>
                        <SettingsPage />
                    </NotificationProvider>
                ),
            },
        ],
    },
])

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />)
