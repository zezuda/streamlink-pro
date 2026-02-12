import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppSettings } from '../src/hooks/useAppSettings';
import { Loader2 } from 'lucide-react';

const AuthHandler: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { settings, setSettings } = useAppSettings();
    const processedRef = useRef(false);

    useEffect(() => {
        // Prevent double processing in StrictMode
        if (processedRef.current) return;

        // Check if the current path contains 'access_token'
        // HashRouter interprets '/#access_token=...' as path '/access_token=...'
        // or sometimes just the root if the hash is malformed.
        // We check the full href to be sure, or the location pathname.

        // The issue: Twitch returns `http://localhost:3000/#access_token=...`
        // HashRouter sees `#` and thinks what follows is the route.
        // So the route becomes `/access_token=...`

        const tokenMatch = location.pathname.match(/access_token=([^&]+)/) || location.hash.match(/access_token=([^&]+)/) || window.location.href.match(/access_token=([^&]+)/);

        if (tokenMatch && tokenMatch[1]) {
            processedRef.current = true;
            const accessToken = tokenMatch[1];
            const clientId = settings.twitchClientId || import.meta.env.VITE_TWITCH_CLIENT_ID;

            console.log("AuthHandler: Token found, verifying...");

            fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Client-ID': clientId,
                    'Authorization': `Bearer ${accessToken}`
                }
            })
                .then(res => {
                    if (!res.ok) throw new Error("Failed to fetch user");
                    return res.json();
                })
                .then(data => {
                    if (data.data && data.data.length > 0) {
                        const user = data.data[0];
                        console.log("AuthHandler: Verified user:", user.login);

                        setSettings(prev => ({
                            ...prev,
                            twitchAccessToken: accessToken,
                            twitchChannel: user.login
                        }));

                        // Redirect to root cleanly
                        navigate('/', { replace: true });

                        // Optional: You might want to trigger a success toast or open settings
                    }
                })
                .catch(err => {
                    console.error("AuthHandler Error:", err);
                    // Redirect anyway to avoid getting stuck
                    navigate('/', { replace: true });
                });
        } else {
            // If we landed here but no token found, just go home
            console.warn("AuthHandler: No token found in URL, redirecting home.");
            navigate('/', { replace: true });
        }
    }, [location, settings.twitchClientId, setSettings, navigate]);

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white space-y-4">
            <Loader2 size={48} className="animate-spin text-[#9146FF]" />
            <h2 className="text-xl font-bold">Verifying Twitch Connection...</h2>
            <p className="text-slate-500">Please wait while we complete the login.</p>
        </div>
    );
};

export default AuthHandler;
