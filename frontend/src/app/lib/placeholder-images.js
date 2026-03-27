const eventPlaceholderImages = [
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1600&q=80"
];
export const trustedBrands = [
    { name: "NovaCorp", mark: "N", accent: "from-sky-400 to-cyan-300" },
    { name: "Apex Labs", mark: "A", accent: "from-indigo-400 to-blue-300" },
    { name: "Vertex One", mark: "V", accent: "from-emerald-400 to-teal-300" },
    { name: "Lumina", mark: "L", accent: "from-amber-300 to-orange-300" },
    { name: "Orbit HQ", mark: "O", accent: "from-fuchsia-400 to-pink-300" }
];
export const testimonialAvatarImage = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&h=240&q=80";
export const testimonials = [
    {
        quote: "EventZen did not just help us organize our annual conference; they transformed how we interact with our 50,000 global attendees.",
        name: "Sarah Jenkins",
        title: "Chief Operations Officer, Global Tech Alliance",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&h=240&q=80",
    },
    {
        quote: "The vendor orchestration tools alone saved our team 200+ hours. EventZen is the backbone of every summit we run.",
        name: "Marcus Osei",
        title: "Director of Events, Apex Labs",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&h=240&q=80",
    },
    {
        quote: "Real-time analytics gave us insights we never had before. Our last gala sold out in under 6 hours thanks to EventZen.",
        name: "Priya Nair",
        title: "Head of Partnerships, NovaCorp",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&h=240&q=80",
    },
    {
        quote: "We switched to EventZen for our entire product launch calendar. The ticketing experience is seamless and our attendees love it.",
        name: "James Whitmore",
        title: "VP of Marketing, Orbit HQ",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=240&h=240&q=80",
    },
];
export function getEventPlaceholderImage(seed) {
    const value = String(seed);
    let hash = 0;
    for (let index = 0; index < value.length; index++) {
        hash = (hash << 5) - hash + value.charCodeAt(index);
        hash |= 0;
    }
    return eventPlaceholderImages[Math.abs(hash) % eventPlaceholderImages.length];
}
