
import React, { useState } from 'react';

type VideoCategory = 'All' | 'Getting Started' | 'DMS & Workshop' | 'Valora Plus Tools' | 'Administration';

interface TutorialVideo {
  id: string;
  title: string;
  category: VideoCategory;
  duration: string;
  thumbnailColor: string;
  description: string;
  isNew?: boolean;
}

const MOCK_VIDEOS: TutorialVideo[] = [
  { id: '1', title: 'Welcome to Valora Plus: Quick Tour', category: 'Getting Started', duration: '3:45', thumbnailColor: 'bg-brand-600', description: 'Overview of the platform and initial profile configuration.' },
  { id: '2', title: 'How to do Smart Reception with AI', category: 'DMS & Workshop', duration: '5:20', thumbnailColor: 'bg-blue-500', description: 'Learn how to use the camera and AI to register vehicles in seconds.', isNew: true },
  { id: '3', title: 'Request an Expert Appraisal', category: 'Valora Plus Tools', duration: '4:10', thumbnailColor: 'bg-emerald-600', description: 'Step-by-step guide to sending photos and requesting reports from our experts.' },
  { id: '4', title: 'Analyze Claim Profitability', category: 'Valora Plus Tools', duration: '6:30', thumbnailColor: 'bg-green-500', description: 'Interpret Analytics charts and improve your margins.' },
  { id: '5', title: 'Planner Management (Kanban)', category: 'DMS & Workshop', duration: '4:50', thumbnailColor: 'bg-orange-500', description: 'Organize the workflow for mechanics and bodywork efficiently.' },
  { id: '6', title: 'Configure Rates and Employees', category: 'Administration', duration: '3:15', thumbnailColor: 'bg-slate-600', description: 'Register your team, assign roles, and configure hourly costs.' },
  { id: '7', title: 'CRM: Quotes and Follow-up', category: 'DMS & Workshop', duration: '4:00', thumbnailColor: 'bg-purple-500', description: 'Convert opportunities into sales and build customer loyalty.' },
];

const Tutorials: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<VideoCategory>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVideos = MOCK_VIDEOS.filter(video => {
    const matchesCategory = selectedCategory === 'All' || video.category === selectedCategory;
    const matchesSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase()) || video.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto p-6 min-h-[calc(100vh-2rem)]">
      
      {/* Header */}
      <div className="mb-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-3 mb-2">
                <span className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Academy</span>
                <span className="text-slate-400 text-sm">v1.0</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Valora Plus Training & Tutorials</h1>
            <p className="text-slate-600 text-lg">Master the platform with our step-by-step videos and get the most out of your workshop.</p>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-brand-50 to-transparent opacity-50"></div>
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-brand-100 rounded-full opacity-30 blur-3xl"></div>
      </div>

      {/* Controls: Search & Filter */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
         
         {/* Categories */}
         <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto scrollbar-hide">
            {['All', 'Getting Started', 'DMS & Workshop', 'Valora Plus Tools', 'Administration'].map((cat) => (
                <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat as VideoCategory)}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        selectedCategory === cat 
                        ? 'bg-brand-600 text-white shadow-md' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    {cat}
                </button>
            ))}
         </div>

         {/* Search */}
         <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <input 
                type="text"
                className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-full bg-white focus:ring-brand-500 focus:border-brand-500 text-sm shadow-sm"
                placeholder="Search tutorial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map(video => (
              <div key={video.id} className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full cursor-pointer">
                  {/* Thumbnail Placeholder */}
                  <div className={`relative h-40 ${video.thumbnailColor} flex items-center justify-center`}>
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                      <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-mono">
                          {video.duration}
                      </span>
                      {video.isNew && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                              New
                          </span>
                      )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                      <div className="mb-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">{video.category}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 mb-2 leading-tight group-hover:text-brand-600 transition-colors">
                          {video.title}
                      </h3>
                      <p className="text-sm text-slate-500 flex-1 line-clamp-3">
                          {video.description}
                      </p>
                  </div>
                  
                  {/* Footer */}
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                      <span className="text-xs font-medium text-brand-600 group-hover:underline">Watch now</span>
                      <svg className="w-4 h-4 text-brand-600 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
              </div>
          ))}
      </div>

      {filteredVideos.length === 0 && (
          <div className="text-center py-20">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900">No tutorials found</h3>
              <p className="text-slate-500">Try different search terms.</p>
          </div>
      )}

    </div>
  );
};

export default Tutorials;
