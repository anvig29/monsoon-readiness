import React, { useState, useEffect } from 'react';

// Preset Personas and Routines
const PERSONA_PRESETS = [
  {
    name: "🏍️ Delivery Partner",
    persona: " ",
    routine: " ",
    vulnerabilities: " "
  },
  {
    name: "🎒 School Student",
    persona: " ",
    routine: " ",
    vulnerabilities: " "
  },
  {
    name: "🚇 Commuter",
    persona: "",
    routine: " ",
    vulnerabilities: " "
  },
  {
    name: "👵 Senior ",
    persona: " ",
    routine: " ",
    vulnerabilities: " "
  }
];

export default function App() {
  // State for API Keys
  const [weatherApiKey, setWeatherApiKey] = useState(() => localStorage.getItem('weather_api_key') || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);

  // Input states
  const [location, setLocation] = useState('Mumbai');
  const [languagePreference, setLanguagePreference] = useState('English');
  const [uiText, setUiText] = useState({});
  const [healthVulnerabilities, setHealthVulnerabilities] = useState(PERSONA_PRESETS[0].vulnerabilities);
  const [userPersona, setUserPersona] = useState(PERSONA_PRESETS[0].persona);
  const [userDailyRoutine, setUserDailyRoutine] = useState(PERSONA_PRESETS[0].routine);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  // App running states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Results states
  const [weatherData, setWeatherData] = useState(null);
  const [actionPlan, setActionPlan] = useState(null);
  
  // Interactive Checklist states
  const [completedActions, setCompletedActions] = useState({});
  const [checkedItems, setCheckedItems] = useState({});
  
  // Community simulation states
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportForm, setReportForm] = useState({
    hazardType: 'Waterlogging',
    description: '',
    locationDetail: ''
  });

  // Load keys on start and show modal if keys are missing
  useEffect(() => {
    if (!weatherApiKey || !openaiApiKey) {
      setShowSettings(true);
    }
  }, []);

  // Save settings helper
  const handleSaveSettings = (wKey, oKey) => {
    localStorage.setItem('weather_api_key', wKey);
    localStorage.setItem('openai_api_key', oKey);
    setWeatherApiKey(wKey);
    setOpenaiApiKey(oKey);
    setShowSettings(false);
  };

  const translateUI = async (language) => {

  if (language === "English") {
    setUiText(defaultLabels);
    return;
  }

  try {

    const keys = Object.keys(defaultLabels);

    const values = Object.values(defaultLabels);

    const response = await fetch(
      "http://localhost:3001/api/translate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          texts: values,
          targetLanguage: language,
          openaiApiKey
        })
      }
    );

      const translated = await response.json();

      const mapped = {};

      keys.forEach((key, index) => {
        mapped[key] = translated[index];
      });

      setUiText(mapped);

    } catch (err) {

      console.error(err);

      setUiText(defaultLabels);

    }

  };
useEffect(() => {
  translateUI(languagePreference);
}, [languagePreference]);
useEffect(() => {

  setUiText(defaultLabels);

}, []);

  // Preset click handler
  const handlePresetSelect = (index) => {
    setSelectedPresetIndex(index);
    setUserPersona(PERSONA_PRESETS[index].persona);
    setUserDailyRoutine(PERSONA_PRESETS[index].routine);
    setHealthVulnerabilities(PERSONA_PRESETS[index].vulnerabilities);
  };

  // Main evaluation trigger
  const handleGeneratePlan = async (e) => {
    e.preventDefault();
    if (!location.trim()) {
      setError('Please enter a location context.');
      return;
    }
    if (!userPersona.trim()) {
      setError('Please describe your persona.');
      return;
    }
    if (!userDailyRoutine.trim()) {
      setError('Please detail your daily routine.');
      return;
    }

    setError('');
    setLoading(true);
    setWeatherData(null);
    setActionPlan(null);
    setCompletedActions({});
    setCheckedItems({});
    setReportSuccess(false);

    try {
      // 1. Fetch live weather & alerts
      const weatherRes = await fetch('http://localhost:3001/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, apiKey: weatherApiKey })
      });

      if (!weatherRes.ok) {
        const errObj = await weatherRes.json();
        throw new Error(errObj.error || 'Failed to fetch weather details.');
      }

      const fetchedWeather = await weatherRes.json();
      setWeatherData(fetchedWeather);

      // 2. Fetch AI Action Plan
      const evalRes = await fetch('http://localhost:3001/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationContext: location,
          weatherConditions: fetchedWeather,
          userPersona, 
          userDailyRoutine,
          openaiApiKey,
          languagePreference,
          healthVulnerabilities
        })
      });

      if (!evalRes.ok) {
        const errObj = await evalRes.json();
        throw new Error(errObj.error || 'Failed to evaluate your daily plan.');
      }

      const plan = await evalRes.json();
      setActionPlan(plan);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred. Please verify your API keys and connection.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle action item
  const toggleAction = (idx) => {
    setCompletedActions(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Toggle checklist item
  const toggleChecklist = (idx) => {
    setCheckedItems(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Submit report simulation
  const handleReportSubmit = async (e) => {
  e.preventDefault();

  if (!reportForm.description.trim() || !reportForm.locationDetail.trim()) {
    alert("Please fill in all fields.");
    return;
  }

  try {
    const response = await fetch(
      "http://localhost:3001/api/community-report",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hazardType: reportForm.hazardType,
          location: reportForm.locationDetail,
          observation: reportForm.description,
          reporter: userPersona || "Anonymous",
          language: languagePreference,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    console.log("Saved:", data);

    setReportSuccess(true);

    setReportForm({
      hazardType: "Waterlogging",
      description: "",
      locationDetail: "",
    });

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

  // Preparedness Score SVGs parameters
  const scoreRadius = 28;
  const scoreCircumference = 2 * Math.PI * scoreRadius;
  const displayScore = actionPlan?.preparednessScore || 0;
  const strokeDashoffset = scoreCircumference - (displayScore / 100) * scoreCircumference;

  const defaultLabels = {
  profile: "User Profile & Routine",
  location: "Current Location",
  language: "Language Preference",
  preset: "Select Persona Preset",
  persona: "Describe User Persona",
  vulnerability: "Medical Conditions / Vulnerabilities",
  routine: "Daily Routine Detail",
  calculate: "Calculate Copilot Plan",
  settings: "Settings",
  community: "Community",
  report: "Submit Verified Report",
  reportTitle: "File Verification Report",
  observation: "Observation Details",
  hazard: "Hazard Type",
  locationDetail: "Location Detail",
  cancel: "Cancel",
  save: "Save Configurations"
};

  return (
    <div className="app-container">
      {/* App Header */}
        <header className="app-header">

        <div className="brand-section">
            <span className="brand-logo">⛈️</span>

            <div>
                <h1 className="brand-title">Monsoon Copilot</h1>
                <p className="brand-subtitle">
                    Grounded, zero-hallucination routine weather protection
                </p>
            </div>
        </div>

        <div className="header-actions">

            <button
                className="btn btn-secondary"
                onClick={() => setShowReportModal(true)}
            >
               🤝 {uiText.community}
            </button>

            <button
                className="btn btn-secondary"
                onClick={() => setShowSettings(true)}
            >
                ⚙️
            </button>

        </div>

    </header>

      {/* Main Grid */}
      <main className="dashboard-grid">
        {/* Left Column: Context Inputs */}
        <section className="card-glass">
          <h2 className="card-title"> 📝 {uiText.profile} </h2>
          <form onSubmit={handleGeneratePlan}>
            
            {/* Location */}
            <div className="form-group">
              <label>{uiText.location}</label>
              <input 
                id="location-input"
                type="text" 
                className="form-input" 
                value={location} 
                onChange={(e) => setLocation(e.target.value)} 
                placeholder="e.g. Mumbai, Maharashtra"
                required
              />
            </div>

            {/* Language Preference */}
            <div className="form-group">
              <label>{uiText.language}</label>
              <select 
                id="language-select" 
                className="form-select"
                value={languagePreference} 
                onChange={(e) => setLanguagePreference(e.target.value)}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
                <option value="Marathi">Marathi (मराठी)</option>
              </select>
            </div>

            {/* Presets Selector */}
            <div className="form-group">
              <label>{uiText.preset}</label>
              <div className="preset-container">
                {PERSONA_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`preset-chip ${selectedPresetIndex === idx ? 'active' : ''}`}
                    onClick={() => handlePresetSelect(idx)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Persona */}
            <div className="form-group">
             <label>{uiText.persona}</label>
              <textarea 
                id="persona-input"
                className="form-input form-textarea" 
                value={userPersona} 
                onChange={(e) => {
                  setUserPersona(e.target.value);
                  setSelectedPresetIndex(-1);
                }} 
                placeholder="e.g. Delivery rider on motorcycle..."
                required
              />
            </div>

            {/* Medical Conditions / Vulnerabilities */}
            <div className="form-group">
              <label>{uiText.vulnerability}</label>
              <textarea 
                id="vulnerabilities-input"
                className="form-input form-textarea" 
                style={{ minHeight: '60px' }}
                value={healthVulnerabilities} 
                onChange={(e) => {
                  setHealthVulnerabilities(e.target.value);
                  setSelectedPresetIndex(-1);
                }} 
                placeholder="e.g. Asthma, Diabetes (Type 1), Osteoarthritis, or None"
              />
            </div>

            {/* Routine */}
            <div className="form-group">
             <label>{uiText.routine}</label>
              <textarea 
                id="routine-input"
                className="form-input form-textarea" 
                value={userDailyRoutine} 
                onChange={(e) => {
                  setUserDailyRoutine(e.target.value);
                  setSelectedPresetIndex(-1);
                }} 
                placeholder="e.g. Commutes from 9 AM to 6 PM, walks..."
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
             ⚡ {uiText.calculate}
            </button>
          </form>

          {/* Live Weather Details card */}
          {weatherData && (
            <div className="weather-details-card" style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}>
              <div className="weather-header">
                <span className="weather-location">{weatherData.locationName}</span>
                {weatherData.conditionIcon && (
                  <img src={weatherData.conditionIcon} alt="Weather Icon" className="weather-icon-img" />
                )}
              </div>
              <div className="weather-temp-row">
                <span className="weather-temp">{weatherData.tempC}°C</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 'bold' }}>{weatherData.conditionText}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Range: {weatherData.minTempC}°C - {weatherData.maxTempC}°C</span>
                </div>
              </div>
              <div className="weather-grid">
                <div className="weather-grid-item">
                  <span>Humidity</span>
                  <span>{weatherData.humidity}%</span>
                </div>
                <div className="weather-grid-item">
                  <span>Wind Speed</span>
                  <span>{weatherData.windKph} kph</span>
                </div>
                <div className="weather-grid-item">
                  <span>Precipitation</span>
                  <span>{weatherData.precipMm} mm</span>
                </div>
                <div className="weather-grid-item">
                  <span>Alerts Count</span>
                  <span>{weatherData.alerts?.length || 0} active</span>
                </div>
              </div>

              {weatherData.alerts && weatherData.alerts.length > 0 && (
                <div className="weather-alerts-section">
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--risk-high)', display: 'block', marginBottom: '0.5rem' }}>🚨 ACTIVE WEATHER WARNINGS:</span>
                  {weatherData.alerts.map((alert, idx) => (
                    <div key={idx} className="weather-alert-pill">
                      <strong>{alert.event}</strong>: {alert.headline || alert.desc}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column: AI Plan Display */}
        <section className="card-glass">
          {loading && (
            <div className="spinner-container">
              <div className="spinner"></div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Analyzing weather metrics against routine context...</p>
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--risk-high)', padding: '1.25rem', borderRadius: 'var(--radius-md)', color: '#f87171' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>⚠️ Action Plan Blocked</h3>
              <p>{error}</p>
              <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => setShowSettings(true)}>
                Check API Keys Settings
              </button>
            </div>
          )}

          {!loading && !error && !actionPlan && (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🗺️</span>
              <h3 style={{ color: '#fff', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>Your Daily Action Plan Awaits</h3>
              <p>Configure your profile and press "Calculate Copilot Plan" to generate your deterministic daily safety assessment.</p>
            </div>
          )}

          {!loading && !error && actionPlan && (
            <div className="fade-in">
              
              {/* Plan Header: Risk and Score */}
              <div className="plan-header">
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Routine Threat Assessment</span>
                  <div className={`risk-badge ${actionPlan.risk}`}>
                    {actionPlan.risk === 'HIGH' && '⚠️ '}
                    {actionPlan.risk === 'MEDIUM' && '⚡ '}
                    {actionPlan.risk === 'LOW' && '✅ '}
                    {actionPlan.risk} RISK
                  </div>
                </div>
                
                <div className="score-gauge-container">
                  <div className="score-gauge">
                    <svg className="score-svg">
                      <circle className="score-bg-circle" cx="35" cy="35" r="28" />
                      <circle 
                        className="score-value-circle" 
                        cx="35" 
                        cy="35" 
                        r="28" 
                        strokeDasharray={scoreCircumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="score-text">{displayScore}</div>
                  </div>
                  <div className="score-label">
                    <span className="score-title">Safety Score</span>
                    <span className="score-desc">Routine safety alignment</span>
                  </div>
                </div>
              </div>

              {/* 1. Top Risks */}
              {actionPlan.topRisks && actionPlan.topRisks.length > 0 && (
                <div className="plan-section">
                  <h3 className="plan-section-title">🚨 {actionPlan.appUiLabels?.threatAnalysis || 'Threat Analysis'}</h3>
                  <div className="risk-list">
                    {actionPlan.topRisks.map((riskItem, idx) => (
                      <div key={idx} className={`risk-item ${actionPlan.risk}`}>
                        <div>{riskItem}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Actions */}
              {actionPlan.actions && actionPlan.actions.length > 0 && (
                <div className="plan-section">
                  <h3 className="plan-section-title">🏃 {actionPlan.appUiLabels?.actionPlan || 'Action Plan'}</h3>
                  <div className="action-list">
                    {actionPlan.actions.map((actionItem, idx) => (
                      <div 
                        key={idx} 
                        className={`action-item ${completedActions[idx] ? 'completed' : ''}`}
                        onClick={() => toggleAction(idx)}
                      >
                        <div className="checkbox-custom"></div>
                        <div>{actionItem}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Avoid */}
              {actionPlan.avoid && actionPlan.avoid.length > 0 && (
                <div className="plan-section">
                  <h3 className="plan-section-title">❌ {actionPlan.appUiLabels?.actionsAvoid || 'Actions to Avoid'}</h3>
                  <div className="risk-list">
                    {actionPlan.avoid.map((avoidItem, idx) => (
                      <div key={idx} className="avoid-item">
                        <div>{avoidItem}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Physical Checklist */}
              {actionPlan.checklist && actionPlan.checklist.length > 0 && (
                <div className="plan-section">
                  <h3 className="plan-section-title">🎒 {actionPlan.appUiLabels?.gearChecklist || 'Physical Gear Checklist'}</h3>
                  <div className="checklist-grid">
                    {actionPlan.checklist.map((item, idx) => (
                      <div 
                        key={idx} 
                        className={`checklist-item ${checkedItems[idx] ? 'checked' : ''}`}
                        onClick={() => toggleChecklist(idx)}
                      >
                        <div className="checkbox-custom"></div>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Community Mutual Aid & Suggestion */}
              {actionPlan.communitySuggestion && (
                <div className="community-callout">
                  <div className="community-header">
                    <span>🤝</span>
                    <span>{actionPlan.appUiLabels?.communityTitle || 'Community Mutual Aid'}</span>
                  </div>
                  {actionPlan.appUiLabels?.communityTagline && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                      {actionPlan.appUiLabels.communityTagline}
                    </p>
                  )}
                  <p className="community-text">{actionPlan.communitySuggestion}</p>
                  
                  <div style={{ marginTop: '0.5rem' }}>
                    <button className="btn btn-primary" onClick={() => setShowReportModal(true)}>
                      📢 Report Live Waterlogging / Flood
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </section>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">🔑 Configure API Keys</h3>
              <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              These keys are saved locally in your browser storage and are sent to the local backend to execute requests.
            </p>
            
            {/* WeatherAPI Key */}
            <div className="form-group">
              <label htmlFor="settings-weather-key">WeatherAPI.com API Key</label>
              <input 
                id="settings-weather-key"
                type="password" 
                className="form-input" 
                value={weatherApiKey} 
                onChange={(e) => setWeatherApiKey(e.target.value)} 
                placeholder="Paste WeatherAPI.com Key"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Get a free key from <a href="https://www.weatherapi.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>weatherapi.com</a></span>
            </div>

            {/* OpenAI API Key */}
            <div className="form-group">
              <label htmlFor="settings-openai-key">OpenAI API Key</label>
              <input 
                id="settings-openai-key"
                type="password" 
                className="form-input" 
                value={openaiApiKey} 
                onChange={(e) => setOpenaiApiKey(e.target.value)} 
                placeholder="sk-..."
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleSaveSettings(weatherApiKey, openaiApiKey)}
              >
                {uiText.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Community Report Simulation Modal */}
      {showReportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              📢 {uiText.reportTitle}
              <button className="modal-close" onClick={() => {
                setShowReportModal(false);
                setReportSuccess(false);
              }}>×</button>
            </div>

            {!reportSuccess ? (
              <form onSubmit={handleReportSubmit} className="report-modal-form">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Contribute to community safety by sharing verified reports of local flood hazards, blockages, or traffic disruptions.
                </p>

                <div className="form-group">
                  <label>{uiText.hazard}</label>
                  <select 
                    id="report-hazard-type"
                    className="form-select"
                    value={reportForm.hazardType}
                    onChange={(e) => setReportForm({ ...reportForm, hazardType: e.target.value })}
                  >
                    <option value="Waterlogging">🌊 Waterlogging / Flooding</option>
                    <option value="Traffic Block">🚗 Traffic gridlock</option>
                    <option value="Tree Fall">🌳 Fallen Tree / Cable</option>
                    <option value="Open Drain">⚠️ Open Manhole / Drain</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>{uiText.locationDetail}</label>
                  <input 
                    id="report-location"
                    type="text" 
                    className="form-input" 
                    value={reportForm.locationDetail}
                    onChange={(e) => setReportForm({ ...reportForm, locationDetail: e.target.value })}
                    placeholder="e.g. Near Metro Station exit 2, Andheri West"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>{uiText.observation}</label>
                  <textarea 
                    id="report-desc"
                    className="form-input form-textarea" 
                    value={reportForm.description}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    placeholder="e.g. Water level is knee-deep. Avoid smaller two-wheelers passing through."
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowReportModal(false)}>{uiText.cancel}</button>
                  <button type="submit" className="btn btn-primary">Submit Verified Report</button>
                </div>
              </form>
            ) : (
              <div className="fade-in" style={{ textAlign: 'center', padding: '1rem 0' }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
                <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Report Submitted Successfully!</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Thank you! Your verified report helps commuters avoid unsafe routes. You have unlocked today's local reward:
                </p>

                {/* Voucher Card Graphic */}
                <div className="voucher-card">
                  <div className="voucher-title">FREE HOT CHAI VOUCHER</div>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>Redeemable at any nearby pitstop</p>
                  <div className="voucher-code">MONSOON-CHAI-992</div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Valid for 24 hours • Powered by Monsoon Copilot Mutual-aid</p>
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    setShowReportModal(false);
                    setReportSuccess(false);
                    setReportForm({ hazardType: 'Waterlogging', description: '', locationDetail: '' });
                  }}
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
