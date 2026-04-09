import React from 'react';
import { BookOpen, Users, Calendar, TrendingUp } from 'lucide-react';

const LandingPage: React.FC = () => {
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <section className="flex flex-col items-center justify-center text-center py-15 px-6 bg-gradient-to-r from-green-700 to-green-900 text-white">
        <h1 className="text-5xl font-extrabold mb-6 py-7">
          Master Your Learning with <span className="text-yellow-300">Cognify</span>
        </h1>
        <p className="text-lg max-w-xl mb-8">
          Personalized tutoring, smart analytics, and progress tracking to help you stay ahead in your studies.
        </p>
      
      
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-12 bg-gray-50">
        <div className="bg-white rounded-xl p-8 shadow hover:shadow-xl transition border border-gray-200">
          <BookOpen className="w-10 h-5 text-green-700 mb-4" />
          <h3 className="text-xl font-semibold mb-3">Interactive Learning</h3>
          <p className="text-gray-600">Engage with AI tutors through live video and audio sessions.</p>
        </div>

        <div className="bg-white rounded-xl p-8 shadow hover:shadow-xl transition border border-gray-200">
          <Users className="w-10 h-5text-green-700 mb-4" />
          <h3 className="text-xl font-semibold mb-3">AI Tutors</h3>
          <p className="text-gray-600">Connect with AI tutors across multiple subjects and skills.</p>
        </div>

        <div className="bg-white rounded-xl p-8 shadow hover:shadow-xl transition border border-gray-200">
          <Calendar className="w-10 h-5 text-green-700 mb-4" />
          <h3 className="text-xl font-semibold mb-3">Smart Scheduling</h3>
          <p className="text-gray-600">Easily book, manage, and track your upcoming tutoring sessions.</p>
        </div>

        <div className="bg-white rounded-xl p-8 shadow hover:shadow-xl transition border border-gray-200">
          <TrendingUp className="w-10 h-5 text-green-700 mb-4" />
          <h3 className="text-xl font-semibold mb-3">Quick Summary</h3>
          <p className="text-gray-600">Get a personalized summary and transcript of the tutoring classes.</p>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;