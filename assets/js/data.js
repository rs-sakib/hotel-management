export const seedData = {
  users: [
    {
      id: "u-admin",
      name: "Sakib Admin",
      email: "admin@sakib.com",
      phone: "+880 1700 111111",
      password: "admin1234",
      role: "admin",
      status: "Active"
    },
    {
      id: "u-guest",
      name: "Samir Chowdhury",
      email: "guest@azurestay.com",
      phone: "+880 1700 222222",
      password: "guest123",
      role: "user",
      status: "Active"
    }
  ],
  hotels: [
    {
      id: "h-ocean-grand",
      name: "Ocean Grand Resort",
      city: "Cox's Bazar, Bangladesh",
      rating: 4.9,
      price: 245,
      rooms: 38,
      image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=85",
      amenities: ["Sea view", "Infinity pool", "Spa", "Airport pickup"],
      description: "A premium beachfront resort built for leisure groups, executive retreats, and VIP arrivals."
    },
    {
      id: "h-urban-crown",
      name: "Urban Crown Hotel",
      city: "Dhaka, Bangladesh",
      rating: 4.8,
      price: 180,
      rooms: 52,
      image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=85",
      amenities: ["Business lounge", "Rooftop dining", "Fast check-in", "Gym"],
      description: "A city hotel tuned for business travelers, conferences, transfers, and high-speed service."
    },
    {
      id: "h-mountain-arc",
      name: "Mountain Arc Retreat",
      city: "Bandarban, Bangladesh",
      rating: 4.7,
      price: 210,
      rooms: 24,
      image: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=85",
      amenities: ["Guided trips", "Private villas", "Fire deck", "Local cuisine"],
      description: "A quiet hillside retreat for curated tours, private villas, and scenic hospitality packages."
    },
    {
      id: "h-lagoon-palace",
      name: "Lagoon Palace Suites",
      city: "Sylhet, Bangladesh",
      rating: 4.9,
      price: 265,
      rooms: 31,
      image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=85",
      amenities: ["Tea garden tours", "Butler service", "Lake deck", "Fine dining"],
      description: "A luxury suite property with calm water views, concierge trips, and private event support."
    },
    {
      id: "h-heritage-house",
      name: "Heritage House",
      city: "Chattogram, Bangladesh",
      rating: 4.6,
      price: 155,
      rooms: 47,
      image: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=85",
      amenities: ["Historic rooms", "Banquet hall", "Concierge", "Valet"],
      description: "A boutique hotel for cultural trips, banquets, and travelers who prefer character-rich stays."
    },
    {
      id: "h-skyline-residence",
      name: "Skyline Residence",
      city: "Dubai, UAE",
      rating: 4.8,
      price: 320,
      rooms: 29,
      image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=85",
      amenities: ["Serviced apartments", "City view", "Executive desk", "Pool"],
      description: "A polished residence hotel for long stays, corporate guests, and international arrivals."
    }
  ],
  trips: [
    {
      id: "t-1",
      title: "Executive Dhaka Summit",
      guest: "Rahman Group",
      destination: "Dhaka",
      dates: "Jun 18-21, 2026",
      status: "Confirmed"
    },
    {
      id: "t-2",
      title: "Cox's Bazar Family Escape",
      guest: "Ayesha Karim",
      destination: "Cox's Bazar",
      dates: "Jul 2-6, 2026",
      status: "Planning"
    },
    {
      id: "t-3",
      title: "Sylhet Tea Valley Retreat",
      guest: "Northstar Team",
      destination: "Sylhet",
      dates: "Aug 12-15, 2026",
      status: "Confirmed"
    }
  ],
  tripBookings: [],
  bookings: []
};
