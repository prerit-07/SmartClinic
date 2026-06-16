import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Receptionist from './screens/Receptionist.jsx';
import Patient from './screens/Patient.jsx';
import Doctor from './screens/Doctor.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/receptionist" element={<Receptionist />} />
        <Route path="/patient"      element={<Patient />} />
        <Route path="/doctor"       element={<Doctor />} />
        <Route path="*"             element={<Navigate to="/patient" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
