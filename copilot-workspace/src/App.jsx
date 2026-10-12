import React, { useState, useEffect } from 'react';
import ThreeHeroCanvas from './components/ThreeHeroCanvas';

// Bulletproof self-contained SVG Icons to eliminate fragile external imports
const Icons = {
  Stethoscope: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4.5 3h3v5a4.5 4.5 0 0 0 9 0V3h3"/>
      <path d="M6 3v2"/>
      <path d="M18 3v2"/>
      <path d="M12 12.5V17a3 3 0 0 0 6 0v-2"/>
      <circle cx="18" cy="15" r="2"/>
    </svg>
  ),
  Search: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  ),
  Calendar: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  ),
  Clock: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  ShieldCheck: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  HeartPulse: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      <path d="M3.22 12H9.5l1.5-3 2 6 1.5-3h4.78"/>
    </svg>
  ),
  AlertTriangle: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <line x1="12" x2="12" y1="9" y2="13"/>
      <line x1="12" x2="12.01" y1="17" y2="17"/>
    </svg>
  ),
  CheckCircle: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  Building: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
      <path d="M9 22v-4h6v4"/>
      <path d="M8 6h.01"/>
      <path d="M16 6h.01"/>
      <path d="M8 10h.01"/>
      <path d="M16 10h.01"/>
      <path d="M8 14h.01"/>
      <path d="M16 14h.01"/>
    </svg>
  ),
  Phone: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  X: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  ),
  Award: ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="6"/>
      <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.2 0l-3.58 2.687a.5.5 0 0 1-.81-.47l1.515-8.526"/>
    </svg>
  ),
  Trash: ({ size = 18, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18"/>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  )
};

const SPECIALTIES = [
  { id: 'All', name: 'All Doctors', icon: '🩺' },
  { id: 'Cardiology', name: 'Cardiology', icon: '❤️' },
  { id: 'Neurology', name: 'Neurology', icon: '🧠' },
  { id: 'Orthopedics', name: 'Orthopedics', icon: '🦴' },
  { id: 'Pediatrics', name: 'Pediatrics', icon: '👶' },
  { id: 'Dermatology', name: 'Dermatology', icon: '✨' },
  { id: 'General Medicine', name: 'General Medicine', icon: '💊' }
];

const TIME_SLOTS = [
  '09:00 AM', '10:00 AM', '11:15 AM', '02:00 PM', '03:30 PM', '05:00 PM', '06:30 PM'
];

const INITIAL_DOCTORS = [
  {
    id: 'doc-1',
    name: 'Dr. Rajesh Sharma',
    specialty: 'Cardiology',
    experience: '18 Years Exp',
    rating: 4.9,
    reviews: 240,
    fee: 850,
    avatar: '👨‍⚕️',
    hospital: 'Apex Heart & Vascular Institute',
    badge: 'Super Specialist'
  },
  {
    id: 'doc-2',
    name: 'Dr. Ananya Iyer',
    specialty: 'Neurology',
    experience: '14 Years Exp',
    rating: 4.9,
    reviews: 178,
    fee: 950,
    avatar: '👩‍⚕️',
    hospital: 'Advanced Neuro & Spine Center',
    badge: 'Gold Medalist'
  },
  {
    id: 'doc-3',
    name: 'Dr. Vikram Malhotra',
    specialty: 'Orthopedics',
    experience: '15 Years Exp',
    rating: 4.8,
    reviews: 195,
    fee: 750,
    avatar: '👨‍⚕️',
    hospital: 'Center for Joint Replacement',
    badge: 'Senior Surgeon'
  },
  {
    id: 'doc-4',
    name: 'Dr. Priya Sen',
    specialty: 'Pediatrics',
    experience: '11 Years Exp',
    rating: 4.9,
    reviews: 260,
    fee: 650,
    avatar: '👩‍⚕️',
    hospital: 'Bloom Children Healthcare',
    badge: 'Child Specialist'
  },
  {
    id: 'doc-5',
    name: 'Dr. Amitav Roy',
    specialty: 'Dermatology',
    experience: '9 Years Exp',
    rating: 4.7,
    reviews: 112,
    fee: 600,
    avatar: '👨‍⚕️',
    hospital: 'Derma Laser & Skin Institute',
    badge: 'Cosmetic Expert'
  },
  {
    id: 'doc-6',
    name: 'Dr. Sneha Verma',
    specialty: 'General Medicine',
    experience: '12 Years Exp',
    rating: 4.8,
    reviews: 185,
    fee: 500,
    avatar: '👩‍⚕️',
    hospital: 'Apex Comprehensive Medical Care',
    badge: 'Consultant'
  }
];

export default function App() {
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    patientName: '',
    phone: '',
    email: '',
    date: '2026-10-15',
    slot: '10:00 AM',
    reason: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Active Appointments
  const [appointments, setAppointments] = useState([
    {
      id: 'APT-1082',
      patientName: 'Aarav Sharma',
      phone: '+91 9876543210',
      doctorName: 'Dr. Rajesh Sharma',
      specialty: 'Cardiology',
      date: '2026-10-14',
      slot: '10:00 AM',
      status: 'Confirmed'
    }
  ]);

  // Toast Notification auto-dismiss
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Filtered Doctors
  const filteredDoctors = INITIAL_DOCTORS.filter((doc) => {
    const matchesSpecialty = selectedSpecialty === 'All' || doc.specialty === selectedSpecialty;
    const matchesSearch = 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.hospital.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSpecialty && matchesSearch;
  });

  // Validate and submit appointment
  const handleBookingSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (!formData.patientName.trim()) {
      errors.patientName = 'Patient full name is required';
    } else if (formData.patientName.trim().length < 3) {
      errors.patientName = 'Name must be at least 3 characters';
    }

    const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      errors.phone = 'Contact number is required';
    } else if (cleanPhone.length < 10) {
      errors.phone = 'Valid 10-digit mobile number required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.date) {
      errors.date = 'Please pick an appointment date';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Success
    const newApt = {
      id: `APT-${Math.floor(1000 + Math.random() * 9000)}`,
      patientName: formData.patientName.trim(),
      phone: formData.phone.trim(),
      doctorName: bookingDoctor.name,
      specialty: bookingDoctor.specialty,
      date: formData.date,
      slot: formData.slot,
      status: 'Confirmed'
    };

    setAppointments([newApt, ...appointments]);
    setNotification({
      type: 'success',
      message: `Appointment scheduled with ${bookingDoctor.name} for ${formData.slot}!`
    });

    // Reset & Close
    setBookingDoctor(null);
    setFormData({
      patientName: '',
      phone: '',
      email: '',
      date: '2026-10-15',
      slot: '10:00 AM',
      reason: ''
    });
    setFormErrors({});
  };

  const cancelAppointment = (id) => {
    setAppointments(appointments.filter(a => a.id !== id));
    setNotification({
      type: 'info',
      message: 'Appointment cancelled successfully'
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f1d] text-slate-100">
      {/* Toast Notification */}
      {notification && (
        <div 
          role="status"
          data-testid="toast-notification"
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderRadius: '12px',
            background: notification.type === 'success' ? '#064e3b' : '#1e293b',
            border: `1px solid ${notification.type === 'success' ? '#10b981' : '#38bdf8'}`,
            color: '#f8fafc',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}
        >
          {notification.type === 'success' ? <Icons.CheckCircle size={20} className="text-emerald-400" /> : <Icons.AlertTriangle size={20} className="text-sky-400" />}
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{notification.message}</span>
        </div>
      )}

      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-12 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Icons.HeartPulse size={24} />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              Apex<span className="text-sky-400">Health</span>
              <span className="text-[10px] font-semibold bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/30">3.0</span>
            </span>
            <p className="text-[11px] text-slate-400 font-medium">Accredited Multi-Specialty Care</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#specialties" className="hover:text-sky-400 transition-colors">Specialties</a>
          <a href="#doctors" className="hover:text-sky-400 transition-colors">Top Doctors</a>
          <a href="#appointments" className="hover:text-sky-400 transition-colors flex items-center gap-1.5">
            Appointments
            {appointments.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[11px] flex items-center justify-center font-bold">
                {appointments.length}
              </span>
            )}
          </a>
          <a href="#about" className="hover:text-sky-400 transition-colors">About Us</a>
        </nav>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowEmergencyModal(true)}
            data-testid="emergency-btn"
            className="btn-danger flex items-center gap-2 text-xs md:text-sm py-2 px-3 md:px-4"
          >
            <Icons.Phone size={15} />
            <span>24/7 SOS Helpline</span>
          </button>
        </div>
      </header>

      {/* 2. Hero Section with 3D WebGL Canvas */}
      <section className="relative overflow-hidden pt-10 pb-16 px-4 lg:px-12 max-w-7xl mx-auto w-full">
        <div className="glow-orb" style={{ top: '-10%', left: '15%', width: '400px', height: '400px', background: 'rgba(14, 165, 233, 0.15)' }} />
        <div className="glow-orb" style={{ bottom: '10%', right: '5%', width: '350px', height: '350px', background: 'rgba(20, 184, 166, 0.12)' }} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
          {/* Left Text Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-400 text-xs font-semibold w-fit">
              <Icons.ShieldCheck size={16} />
              <span>NABH & JCI Accredited Hospital Network</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Next-Gen Medical Care & <span className="gradient-text">Instant Specialist Consultations</span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed">
              Connect with India's top super-specialist physicians in minutes. Book offline OPD visits or seamless telemedicine video consultations with zero waiting queue.
            </p>

            {/* Quick Search */}
            <div className="glass-panel p-2.5 sm:p-3 flex flex-col sm:flex-row gap-2 max-w-xl">
              <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-700/60">
                <Icons.Search size={18} className="text-slate-400" />
                <input 
                  type="text"
                  data-testid="search-input"
                  placeholder="Search doctor, cardiology, hospital..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-slate-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white" aria-label="Clear Search">
                    <Icons.X size={16} />
                  </button>
                )}
              </div>
              <a href="#doctors" className="btn-primary text-center">
                <span>Find Doctors</span>
              </a>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800/80 max-w-lg">
              <div>
                <p className="text-2xl font-bold text-white">120+</p>
                <p className="text-xs text-slate-400">Super Specialists</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-sky-400">50K+</p>
                <p className="text-xs text-slate-400">Patients Treated</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-teal-400">99.4%</p>
                <p className="text-xs text-slate-400">Satisfaction Rate</p>
              </div>
            </div>
          </div>

          {/* Right 3D Interactive Canvas Column */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="w-full glass-panel p-4 rounded-3xl border border-sky-500/20 relative shadow-2xl shadow-sky-950/50">
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-sky-500/30 text-xs text-sky-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Interactive 3D Vital Helix</span>
              </div>
              <div className="h-[360px] w-full rounded-2xl overflow-hidden bg-slate-950/60">
                <ThreeHeroCanvas />
              </div>
              <p className="text-[11px] text-slate-400 text-center mt-2.5">
                Hover & move cursor to interact with real-time 3D cellular geometry
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Specialties Filter Carousel */}
      <section id="specialties" className="py-8 px-4 lg:px-12 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Browse By Specialty</h2>
            <p className="text-xs md:text-sm text-slate-400 mt-1">Select a department to filter verified clinical specialists</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
          {SPECIALTIES.map((spec) => {
            const isActive = selectedSpecialty === spec.id;
            return (
              <button
                key={spec.id}
                onClick={() => setSelectedSpecialty(spec.id)}
                data-testid={`specialty-btn-${spec.id}`}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap border ${
                  isActive 
                    ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/30' 
                    : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <span>{spec.icon}</span>
                <span>{spec.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Doctors Directory Grid */}
      <section id="doctors" className="py-10 px-4 lg:px-12 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Available Specialists</h2>
            <p className="text-sm text-slate-400 mt-1">
              Showing {filteredDoctors.length} verified physicians ready for consultation
            </p>
          </div>
        </div>

        {filteredDoctors.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl max-w-md mx-auto my-6">
            <Icons.Stethoscope size={40} className="text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No doctors found</h3>
            <p className="text-sm text-slate-400 mt-1">Try clearing your search query or selecting a different specialty filter.</p>
            <button 
              onClick={() => { setSelectedSpecialty('All'); setSearchQuery(''); }}
              className="btn-secondary mt-4 text-xs py-2 px-4"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDoctors.map((doc) => (
              <div 
                key={doc.id}
                data-testid={`doctor-card-${doc.id}`}
                className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col justify-between group hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-950/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl">
                      {doc.avatar}
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/25">
                      {doc.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition-colors">
                    {doc.name}
                  </h3>
                  <p className="text-xs text-sky-400 font-medium mt-0.5">{doc.specialty}</p>

                  <div className="flex items-center gap-3 text-xs text-slate-400 my-3">
                    <span className="flex items-center gap-1">
                      <Icons.Award size={14} className="text-amber-400" />
                      {doc.experience}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-white">
                      ★ {doc.rating} <span className="text-slate-400 font-normal">({doc.reviews})</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-5">
                    <Icons.Building size={14} className="text-slate-500 shrink-0" />
                    <span className="truncate">{doc.hospital}</span>
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Consultation Fee</span>
                    <span className="text-lg font-extrabold text-white">₹{doc.fee}</span>
                  </div>

                  <button
                    onClick={() => {
                      setBookingDoctor(doc);
                      setFormErrors({});
                    }}
                    data-testid={`book-doctor-${doc.id}`}
                    className="btn-primary text-xs py-2 px-4"
                  >
                    <Icons.Calendar size={14} />
                    <span>Book Visit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Patient Active Appointments Dashboard */}
      <section id="appointments" className="py-12 px-4 lg:px-12 max-w-7xl mx-auto w-full">
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
                <Icons.Calendar size={22} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-white">Your Appointments Portal</h2>
                <p className="text-xs text-slate-400">View upcoming clinical visits, timings, and status</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-slate-800 text-slate-300 rounded-full">
              {appointments.length} Total
            </span>
          </div>

          {appointments.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
              <Icons.Calendar size={32} className="text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-medium">No active appointments scheduled.</p>
              <p className="text-xs text-slate-500 mt-1">Select any doctor from the list above to book a new visit.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointments.map((apt) => (
                <div 
                  key={apt.id} 
                  data-testid={`appointment-card-${apt.id}`}
                  className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-sky-400 font-bold bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50">
                        {apt.id}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                        <Icons.CheckCircle size={12} />
                        {apt.status}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white">{apt.doctorName}</h4>
                    <p className="text-xs text-teal-400">{apt.specialty}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-3 pt-3 border-t border-slate-800/80">
                      <span className="flex items-center gap-1.5">
                        <Icons.Calendar size={14} className="text-slate-400" />
                        {apt.date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icons.Clock size={14} className="text-slate-400" />
                        {apt.slot}
                      </span>
                      <span className="text-slate-400">
                        Patient: <strong className="text-slate-200">{apt.patientName}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      onClick={() => cancelAppointment(apt.id)}
                      data-testid={`cancel-appointment-${apt.id}`}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                    >
                      <Icons.Trash size={14} />
                      <span>Cancel Visit</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 6. Testimonials & Accreditations */}
      <section id="about" className="py-12 px-4 lg:px-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                RK
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Rohit Kapoor</h4>
                <p className="text-xs text-slate-400">Cardiology Patient</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              "Dr. Rajesh Sharma was thorough, patient, and precise. The digital booking through ApexHealth took less than 60 seconds."
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                PM
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Pooja Mishra</h4>
                <p className="text-xs text-slate-400">Pediatrics Consultation</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              "Immediate consultation for my daughter with Dr. Priya Sen. The diagnosis was prompt, and the hospital staff was courteous."
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                VS
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Vikram Saraf</h4>
                <p className="text-xs text-slate-400">Orthopedic Care</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              "Outstanding joint therapy regimen. The 3D clinic overview and seamless follow-ups made recovery stress-free."
            </p>
          </div>
        </div>
      </section>

      {/* 7. Appointment Booking Modal */}
      {bookingDoctor && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          data-testid="booking-modal"
        >
          <div className="glass-panel bg-[#0e1628] border border-slate-700 w-full max-w-lg rounded-3xl p-6 sm:p-8 relative shadow-2xl">
            <button 
              onClick={() => { setBookingDoctor(null); setFormErrors({}); }}
              data-testid="close-modal-btn"
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
              aria-label="Close Booking Modal"
            >
              <Icons.X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl border border-slate-700">
                {bookingDoctor.avatar}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Book Consultation</h3>
                <p className="text-xs text-sky-400">{bookingDoctor.name} • {bookingDoctor.specialty}</p>
              </div>
            </div>

            <form onSubmit={handleBookingSubmit} className="flex flex-col gap-4">
              {/* Patient Name */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Patient Full Name *</label>
                <input 
                  type="text"
                  data-testid="input-patient-name"
                  value={formData.patientName}
                  onChange={(e) => {
                    setFormData({ ...formData, patientName: e.target.value });
                    if (formErrors.patientName) setFormErrors({ ...formErrors, patientName: null });
                  }}
                  placeholder="e.g. Rahul Verma"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 ${
                    formErrors.patientName ? 'border-rose-500' : 'border-slate-800'
                  }`}
                />
                {formErrors.patientName && (
                  <p className="text-[11px] text-rose-400 mt-1" data-testid="error-patient-name">{formErrors.patientName}</p>
                )}
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Mobile Phone Number *</label>
                <input 
                  type="tel"
                  data-testid="input-phone"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (formErrors.phone) setFormErrors({ ...formErrors, phone: null });
                  }}
                  placeholder="+91 9876543210"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 ${
                    formErrors.phone ? 'border-rose-500' : 'border-slate-800'
                  }`}
                />
                {formErrors.phone && (
                  <p className="text-[11px] text-rose-400 mt-1" data-testid="error-phone">{formErrors.phone}</p>
                )}
              </div>

              {/* Date & Slot */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Preferred Date *</label>
                  <input 
                    type="date"
                    data-testid="input-date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Time Slot *</label>
                  <select
                    data-testid="select-slot"
                    value={formData.slot}
                    onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-sky-500"
                  >
                    {TIME_SLOTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Consultation Fee Notice */}
              <div className="bg-sky-500/10 border border-sky-500/25 p-3 rounded-xl flex items-center justify-between text-xs mt-2">
                <span className="text-slate-300">OPD Consultation Fee:</span>
                <span className="text-base font-bold text-sky-400">₹{bookingDoctor.fee}</span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={() => { setBookingDoctor(null); setFormErrors({}); }}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-booking-btn"
                  className="btn-primary text-xs py-2.5 px-6"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Emergency SOS Modal */}
      {showEmergencyModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          data-testid="emergency-modal"
        >
          <div className="glass-panel bg-[#150a0a] border border-rose-500/50 w-full max-w-md rounded-3xl p-6 sm:p-8 relative shadow-2xl">
            <button 
              onClick={() => setShowEmergencyModal(false)}
              data-testid="close-emergency-btn"
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
              aria-label="Close SOS Modal"
            >
              <Icons.X size={20} />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-500 border border-rose-500/40 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Icons.Phone size={28} />
            </div>

            <h3 className="text-xl font-bold text-white text-center">24/7 Apex Trauma & Ambulance</h3>
            <p className="text-xs text-slate-300 text-center mt-2">
              For acute cardiac emergencies, severe trauma, or urgent ambulance dispatch:
            </p>

            <div className="my-6 flex flex-col gap-3">
              <a 
                href="tel:108"
                className="btn-danger w-full text-center py-3 text-base flex items-center justify-center gap-2"
              >
                <Icons.Phone size={18} />
                <span>Call Emergency: 108 / 112</span>
              </a>

              <a 
                href="tel:18002739000"
                className="btn-secondary w-full text-center py-2.5 text-xs flex items-center justify-center gap-2 text-slate-300"
              >
                <span>Hospital Hotline: 1800-APEX-CARE</span>
              </a>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Our GPS ambulance dispatch unit reaches within 12 minutes in urban areas.
            </p>
          </div>
        </div>
      )}

      {/* 9. Comprehensive Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#070b16] py-12 px-4 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <Icons.HeartPulse size={22} className="text-sky-400" />
              <span className="text-lg font-bold text-white">ApexHealth 3.0</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Leading the healthcare transformation with AI-assisted scheduling, top super-specialist consultations, and accredited hospitals.
            </p>
          </div>

          <div>
            <h5 className="text-sm font-bold text-white mb-3">Clinical Specialties</h5>
            <ul className="text-xs text-slate-400 flex flex-col gap-2">
              <li><a href="#specialties" className="hover:text-sky-400">Cardiology & Heart Center</a></li>
              <li><a href="#specialties" className="hover:text-sky-400">Neurology & Brain Sciences</a></li>
              <li><a href="#specialties" className="hover:text-sky-400">Orthopedic & Joint Surgery</a></li>
              <li><a href="#specialties" className="hover:text-sky-400">Pediatric Care</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-sm font-bold text-white mb-3">Accreditations</h5>
            <ul className="text-xs text-slate-400 flex flex-col gap-2">
              <li>NABH Certified Quality</li>
              <li>JCI Accredited Infrastructure</li>
              <li>ISO 9001:2015 Clinical Safety</li>
              <li>24/7 Digital Health Records</li>
            </ul>
          </div>

          <div>
            <h5 className="text-sm font-bold text-white mb-3">24/7 Support</h5>
            <p className="text-xs text-slate-400">Central Helpline: +91 1800-APEX-CARE</p>
            <p className="text-xs text-slate-400 mt-1">Email: emergency@apexhealth.in</p>
            <p className="text-xs text-slate-500 mt-4">
              © {new Date().getFullYear()} ApexHealth Healthcare Systems. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
