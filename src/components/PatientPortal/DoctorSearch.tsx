import React, { useState, useEffect } from 'react';
import { Doctor } from '../../types';
import { doctorApi } from '../../services/api';
import { Search, Stethoscope, Clock, Calendar, ChevronRight } from 'lucide-react';

interface DoctorSearchProps {
  onSelectDoctor: (doctor: Doctor) => void;
}

export const DoctorSearch: React.FC<DoctorSearchProps> = ({ onSelectDoctor }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedSpecialisation, setSelectedSpecialisation] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const specialisations = ['All', 'Cardiology', 'Dermatology', 'Neurology', 'Pediatrics', 'General Medicine', 'Orthopedics', 'Psychiatry'];

  useEffect(() => {
    fetchDoctors();
  }, [selectedSpecialisation, searchQuery]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const data = await doctorApi.getAll(selectedSpecialisation, searchQuery);
      setDoctors(data);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Search bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-cyan-400" />
            Find Your Specialist & Book Consultation
          </h2>
          <p className="text-slate-400 text-sm">
            Search doctors by medical specialty, view slot availability, and share symptoms in advance for AI pre-visit analysis.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search doctor or symptom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Specialty Filter Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {specialisations.map((spec) => (
          <button
            key={spec}
            onClick={() => setSelectedSpecialisation(spec)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedSpecialisation === spec
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            {spec}
          </button>
        ))}
      </div>

      {/* Doctor Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Searching specialist availability...</div>
      ) : doctors.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-slate-400">
          No specialists found matching your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doc) => (
            <div key={doc.id} className="glass-panel rounded-2xl p-6 flex flex-col justify-between glass-panel-hover">
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
                    {doc.name.charAt(4) || 'D'}
                  </div>
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    {doc.specialisation}
                  </span>
                </div>

                <h3 className="font-bold text-white text-lg mt-4">{doc.name}</h3>
                <p className="text-xs text-slate-400">{doc.email}</p>

                <div className="mt-4 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Working Hours: {doc.working_start} - {doc.working_end}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Consultation Slot: {doc.slot_duration} minutes</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={() => onSelectDoctor(doc)}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 group"
                >
                  <span>Book Appointment</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
