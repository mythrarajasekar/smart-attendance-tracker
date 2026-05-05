import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { fetchMyProfile, updateMyProfile, uploadProfilePhoto } from '../store/userSlice';

interface FacultyProfileProps {
  readOnly?: boolean;
}

const FacultyProfile: React.FC<FacultyProfileProps> = ({ readOnly = false }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { currentProfile, isSaving, isLoading, error } = useSelector((s: RootState) => s.users);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => { dispatch(fetchMyProfile()); }, [dispatch]);

  useEffect(() => {
    if (currentProfile) {
      setName(currentProfile.name || '');
      setPhone(currentProfile.phone || '');
      setDesignation(currentProfile.designation || '');
    }
  }, [currentProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    const result = await dispatch(updateMyProfile({ name, phone: phone || null, designation: designation || null }));
    if (updateMyProfile.fulfilled.match(result)) setSuccessMsg('Profile updated successfully');
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) dispatch(uploadProfilePhoto(file));
  };

  if (isLoading) return <div aria-busy="true">Loading profile...</div>;

  return (
    <form data-testid="faculty-profile-form" onSubmit={handleSubmit} aria-label="Faculty profile">
      {currentProfile?.profilePhotoUrl && (
        <img src={currentProfile.profilePhotoUrl} alt="Profile photo" width={100} height={100} />
      )}
      {!readOnly && (
        <div>
          <label htmlFor="faculty-photo-upload">Update photo</label>
          <input
            id="faculty-photo-upload"
            data-testid="faculty-profile-photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            aria-label="Upload profile photo"
          />
        </div>
      )}

      <div data-testid="faculty-profile-employee-id-display" aria-label="Employee ID">
        Employee ID: {currentProfile?.employeeId}
      </div>
      <div data-testid="faculty-profile-department-display" aria-label="Department">
        Department: {currentProfile?.department}
      </div>

      <div>
        <label htmlFor="faculty-name">Full Name</label>
        <input
          id="faculty-name"
          data-testid="faculty-profile-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={readOnly || isSaving}
          aria-required="true"
        />
      </div>
      <div>
        <label htmlFor="faculty-phone">Phone</label>
        <input
          id="faculty-phone"
          data-testid="faculty-profile-phone-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={readOnly || isSaving}
        />
      </div>
      <div>
        <label htmlFor="faculty-designation">Designation</label>
        <input
          id="faculty-designation"
          data-testid="faculty-profile-designation-input"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          disabled={readOnly || isSaving}
        />
      </div>

      {error && <div role="alert" aria-live="assertive">{error}</div>}
      {successMsg && <div role="status" aria-live="polite">{successMsg}</div>}

      {!readOnly && (
        <button
          type="submit"
          data-testid="faculty-profile-save-button"
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      )}
    </form>
  );
};

export default FacultyProfile;
