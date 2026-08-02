import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/common/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Features from './pages/Features.jsx';
import FeatureDetail from './pages/FeatureDetail.jsx';
import TestPlans from './pages/TestPlans.jsx';
import TestPlanDetail from './pages/TestPlanDetail.jsx';
import TestCases from './pages/TestCases.jsx';
import TestCaseDetail from './pages/TestCaseDetail.jsx';
import TestRuns from './pages/TestRuns.jsx';
import TestRunDetail from './pages/TestRunDetail.jsx';
import Defects from './pages/Defects.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import PipelineFlow from './pages/PipelineFlow.jsx';
import ProcessFlow from './pages/ProcessFlow.jsx';
import MemoryArchitecture from './pages/MemoryArchitecture.jsx';
import GlobalTemplates from './pages/GlobalTemplates.jsx';

// Auth guard — redirects to /login if no token stored
function RequireAuth({ children }) {
  const token = localStorage.getItem('tamt_token');
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected */}
        <Route path="/*" element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/features" element={<Features />} />
                <Route path="/features/:id" element={<FeatureDetail />} />
                <Route path="/test-plans" element={<TestPlans />} />
                <Route path="/test-plans/:id" element={<TestPlanDetail />} />
                <Route path="/test-cases" element={<TestCases />} />
                <Route path="/test-cases/:id" element={<TestCaseDetail />} />
                <Route path="/test-runs" element={<TestRuns />} />
                <Route path="/test-runs/:id" element={<TestRunDetail />} />
                <Route path="/defects" element={<Defects />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/pipeline" element={<PipelineFlow />} />
                <Route path="/global-templates" element={<GlobalTemplates />} />
                <Route path="/process-flow" element={<ProcessFlow />} />
                <Route path="/memory-arch" element={<MemoryArchitecture />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </RequireAuth>
        } />
      </Routes>
    </BrowserRouter>
  );
}
