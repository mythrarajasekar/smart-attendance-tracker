import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { fetchMyProfile, updateMyProfile, uploadProfilePhoto } from '../store/userSlice';

interface StudentProfileProps {
  readOnly?: boolean;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ readOnly = false }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { currentProfile, isSaving, isLoading, error } = useSelector((s: RootState) => s.users);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [yearSemester, setYearSemester] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    dispatch(fetchMyProfile());
  }, [dispatch]);

  useEffect(() => {
    if (currentProfile) {
      setName(currentProfile.name || '');
      setPhone(currentProfile.phone || '');
      setParentContact(currentProfile.parentContact || '');
      setYearSemester(currentProfile.yearSemester || '');
    }
  }, [currentProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    const result = await dispatch(updateMyProfile({ name, phone: phone || null, parentContact: parentContact || null, yearSemester }));
    if (updateMyProfile.fulfilled.match(result)) setSuccessMsg('Profile updated successfully');
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) dispatch(uploadProfilePhoto(file));
  };

  if (isLoading) return <div aria-busy="true">Loading profile...</div>;

  return (
    <form data-testid="student-profile-form" onSubmit={handleSubmit} aria-label="Student profile">
      {currentProfile?.profilePhotoUrl && (
        <img src={currentProfile.profilePhotoUrl} alt="Profile photo" width={100} height={100} />
      )}
      {!readOnly && (
        <div>
          <label htmlFor="student-photo-upload">Update photo</label>
          <input
            id="student-photo-upload"
            data-testid="student-profile-photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            aria-label="Upload profile photo"
          />
        </div>
      )}

      {/* Read-only fields */}
      <div data-testid="student-profile-roll-number-display" aria-label="Roll number">
        Roll Number: {currentProfile?.rollNumber}
      </div>
      <div data-testid="student-profile-department-display" aria-label="Department">
        Department: {currentProfile?.department}
      </div>

      {/* Editable fields */}
      <div>
        <label htmlFor="student-name">Full Name</label>
        <input
          id="student-name"
          data-testid="student-profile-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={readOnly || isSaving}
          aria-required="true"
        />
      </div>
      <div>
        <label htmlFor="student-phone">Phone</label>
        <input
          id="student-phone"
          data-testid="student-profile-phone-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={readOnly || isSaving}
        />
      </div>
      <div>
        <label htmlFor="student-parent-contact">Parent Contact</label>
        <input
          id="student-parent-contact"
          data-testid="student-profile-parent-contact-input"
          value={parentContact}
          onChange={(e) => setParentContact(e.target.value)}
          disabled={readOnly || isSaving}
        />
      </div>
      <div>
        <label htmlFor="student-year-semester">Year / Semester</label>
        <input
          id="student-year-semester"
          data-testid="student-profile-year-semester-input"
          value={yearSemester}
          onChange={(e) => setYearSemester(e.target.value)}
          disabled={readOnly || isSaving}
        />
      </div>

      {error && <div role="alert" aria-live="assertive">{error}</div>}
      {successMsg && <div role="status" aria-live="polite">{successMsg}</div>}

      {!readOnly && (
        <button
          type="submit"
          data-testid="student-profile-save-button"
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      )}
    </form>
  );
};

export default StudentProfile;
