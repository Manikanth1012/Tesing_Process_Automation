import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/common/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
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

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
