import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { User, Mail, Phone, MapPin, FileText, Upload, Trash2, Save, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      location: user?.location || '',
      bio: user?.bio || '',
      skills: user?.skills?.join(', ') || '',
      experience: user?.experience || '',
      education: user?.education || '',
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation(
    (data) => userAPI.updateProfile(data),
    {
      onSuccess: (response) => {
        updateUser(response.data.user);
        toast.success('Profile updated successfully!');
        setIsEditing(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update profile');
      },
    }
  );

  // Upload CV mutation
  const uploadCVMutation = useMutation(
    (formData) => userAPI.uploadCV(formData),
    {
      onSuccess: (response) => {
        updateUser(response.data.user);
        toast.success('CV uploaded successfully!');
        setIsUploading(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to upload CV');
        setIsUploading(false);
      },
    }
  );

  // Delete CV mutation
  const deleteCVMutation = useMutation(
    () => userAPI.deleteCV(),
    {
      onSuccess: (response) => {
        updateUser(response.data.user);
        toast.success('CV deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to delete CV');
      },
    }
  );

  const onSubmit = (data) => {
    const formattedData = {
      ...data,
      skills: data.skills.split(',').map(skill => skill.trim()).filter(skill => skill),
    };
    updateProfileMutation.mutate(formattedData);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('File size must be less than 5MB');
        return;
      }
      
      setIsUploading(true);
      const formData = new FormData();
      formData.append('cv', file);
      uploadCVMutation.mutate(formData);
    }
  };

  const handleDeleteCV = () => {
    if (window.confirm('Are you sure you want to delete your CV?')) {
      deleteCVMutation.mutate();
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600 mt-1">
            Manage your personal information and preferences
          </p>
        </div>
        <div className="flex space-x-3">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  reset();
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="profile-form"
                disabled={updateProfileMutation.isLoading}
                className="btn btn-primary"
              >
                {updateProfileMutation.isLoading ? (
                  <div className="flex items-center">
                    <div className="loading-spinner mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn btn-primary"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
          </div>
          <div className="card-body space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('name', { required: 'Name is required' })}
                    type="text"
                    disabled={!isEditing}
                    className={`input pl-10 ${!isEditing ? 'bg-gray-50' : ''} ${
                      errors.name ? 'border-red-500' : ''
                    }`}
                    placeholder="Enter your full name"
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: 'Please enter a valid email address',
                      },
                    })}
                    type="email"
                    disabled={!isEditing}
                    className={`input pl-10 ${!isEditing ? 'bg-gray-50' : ''} ${
                      errors.email ? 'border-red-500' : ''
                    }`}
                    placeholder="Enter your email address"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('phone')}
                    type="tel"
                    disabled={!isEditing}
                    className={`input pl-10 ${!isEditing ? 'bg-gray-50' : ''}`}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('location')}
                    type="text"
                    disabled={!isEditing}
                    className={`input pl-10 ${!isEditing ? 'bg-gray-50' : ''}`}
                    placeholder="City, State, Country"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                {...register('bio')}
                rows={4}
                disabled={!isEditing}
                className={`textarea ${!isEditing ? 'bg-gray-50' : ''}`}
                placeholder="Tell us a bit about yourself..."
              />
            </div>
          </div>
        </div>

        {/* Professional Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Professional Information</h2>
          </div>
          <div className="card-body space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skills (comma-separated)
              </label>
              <input
                {...register('skills')}
                type="text"
                disabled={!isEditing}
                className={`input ${!isEditing ? 'bg-gray-50' : ''}`}
                placeholder="JavaScript, React, Node.js, Python, etc."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Experience
                </label>
                <select
                  {...register('experience')}
                  disabled={!isEditing}
                  className={`select ${!isEditing ? 'bg-gray-50' : ''}`}
                >
                  <option value="">Select experience level</option>
                  <option value="entry">Entry Level (0-2 years)</option>
                  <option value="mid">Mid Level (3-5 years)</option>
                  <option value="senior">Senior Level (6+ years)</option>
                  <option value="executive">Executive Level</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Education
                </label>
                <input
                  {...register('education')}
                  type="text"
                  disabled={!isEditing}
                  className={`input ${!isEditing ? 'bg-gray-50' : ''}`}
                  placeholder="Highest education level"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CV Upload */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Resume/CV</h2>
          </div>
          <div className="card-body">
            {user?.cvPath ? (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      CV Uploaded
                    </p>
                    <p className="text-xs text-gray-500">
                      {user.cvPath}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteCV}
                  disabled={deleteCVMutation.isLoading}
                  className="btn btn-danger"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteCVMutation.isLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-4">
                  No CV uploaded yet. Upload your resume to enhance your applications.
                </p>
                <label className="btn btn-primary cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CV
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default Profile;