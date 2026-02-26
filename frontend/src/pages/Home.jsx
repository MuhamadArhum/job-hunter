import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Target, Users, CheckCircle } from 'lucide-react';

const Home = () => {
  const features = [
    {
      icon: <Zap className="h-8 w-8 text-blue-600" />,
      title: 'AI-Powered Cover Letters',
      description: 'Generate personalized, professional cover letters using advanced AI technology.',
    },
    {
      icon: <Target className="h-8 w-8 text-blue-600" />,
      title: 'Smart Job Matching',
      description: 'Automatically find and match jobs based on your skills and preferences.',
    },
    {
      icon: <Users className="h-8 w-8 text-blue-600" />,
      title: 'Application Tracking',
      description: 'Keep track of all your applications in one place with detailed analytics.',
    },
  ];

  const steps = [
    {
      step: 1,
      title: 'Create Your Profile',
      description: 'Set up your professional profile with your skills, experience, and preferences.',
    },
    {
      step: 2,
      title: 'Find Jobs',
      description: 'Search and discover job opportunities that match your criteria.',
    },
    {
      step: 3,
      title: 'Generate Cover Letters',
      description: 'Let AI create personalized cover letters for each application.',
    },
    {
      step: 4,
      title: 'Apply & Track',
      description: 'Send applications and track your progress all in one place.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Land Your Dream Job with
              <span className="block text-blue-200">AI-Powered Applications</span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
              Automate your job search with intelligent job matching, AI-generated cover letters, 
              and comprehensive application tracking. Get hired faster with our cutting-edge technology.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="btn btn-primary bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="btn btn-outline border-white text-white hover:bg-white hover:text-blue-600 px-8 py-3 text-lg"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Land Your Next Job
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our AI-powered platform streamlines your job search process, helping you 
              create compelling applications and track your progress efficiently.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card text-center p-8">
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Get started in minutes with our simple 4-step process
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Job Search?
          </h2>
          <p className="text-xl mb-8 text-blue-100 max-w-3xl mx-auto">
            Join thousands of job seekers who have accelerated their career with our 
            AI-powered job application platform.
          </p>
          <Link
            to="/register"
            className="btn btn-primary bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg"
          >
            Start Your Free Trial
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;