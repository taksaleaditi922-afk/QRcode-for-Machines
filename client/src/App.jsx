import { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeCheck, Bell, Check, ChevronDown, CircleHelp, ClipboardList, Cog, Download, Factory, FileSpreadsheet, Gauge, LifeBuoy, LoaderCircle, LogOut, Menu, Moon, Plus, QrCode, Search, ShieldCheck, Smartphone, Wrench, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { downloadFile, request, uploadImage } from './api.js';
import { brand } from './brand.js';
import { useCallback, useMemo, useState } from 'react';

const Dashboard = lazy(() => Promise.resolve({ default: AdminApp }));
const machineCodePattern = /^[a-z\d]+$/i;

function Brand({ light = false }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-icon"><Cog size={21} strokeWidth={2.3} /><span /></span><span className="brand-copy"><b>{brand.name}</b><small>MOBILITY &amp; MACHINE CARE</small></span></div>;
}

function PageLoader() { return <div className="page-loader"><LoaderCircle className="spin" size={28} /><span>Preparing your workspace…</span></div>; }

export default function App() {
  useEffect(() => {
    document.title = `${brand.name} — Machine Care`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${brand.name} — equipment installation and service support.`);
  }, []);
  return <Suspense fallback={<PageLoader />}><Routes>
    <Route path="/" element={<Navigate to="/app" replace />} />
    <Route path="/app" element={<CustomerAppHome />} />
    <Route path="/login" element={<Login />} />
    <Route path="/m/:machineCode" element={<MachinePage />} />
    <Route path="/m/:machineCode/customer" element={<MachinePage customerPortal />} />
    <Route path="/m/:machineCode/engineer" element={<MachinePage engineerPortal />} />
    <Route path="/engineer" element={<EngineerTicketPortal />} />
    <Route path="/engineer/:machineCode" element={<MachinePage engineerPortal />} />
    <Route path="/track/:ticketNumber" element={<TicketTracker />} />
    <Route path="/admin/*" element={<Dashboard />} />
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense>;
}

function CustomerAppHome() {
  const navigate = useNavigate();
  const [machineCode, setMachineCode] = useState('');
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  useEffect(() => {
    function handleInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);
  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }
  function openMachine(event) {
    event.preventDefault();
    const code = machineCode.trim();
    if (!machineCodePattern.test(code)) {
      setError('Enter the machine code printed below its QR code.');
      return;
    }
    navigate(`/m/${encodeURIComponent(code.toUpperCase())}`);
  }
  return <PublicShell label="CUSTOMER APP">
    <div className="public-intro"><span className="eyebrow">VE R MOBILITY SOLUTIONS</span><h1>Expert care for<br /><em>every machine.</em></h1><p>From installation to after-sales service, we keep your workshop equipment ready to work.</p></div>
    <div className="public-card">
      <form className="form-stack compact" onSubmit={openMachine}>
        <label className="field-label">Open your machine<input value={machineCode} onChange={(event) => { setMachineCode(event.target.value); setError(''); }} autoCapitalize="characters" autoComplete="off" placeholder="Enter machine code" aria-describedby={error ? 'machine-code-error' : undefined} /></label>
        {error && <div id="machine-code-error" className="alert-error" role="alert">{error}</div>}
        <button className="button button-primary button-full"><QrCode size={17} /> Continue to machine care <ArrowRight size={16} /></button>
      </form>
      <div className="privacy-note"><Smartphone size={15} /> Scanning your machine's QR code opens its customer care page directly.</div>
      {installPrompt
        ? <button type="button" className="button button-soft button-full" onClick={installApp}>Install customer app</button>
        : <p className="muted install-hint">To add this app to your home screen, use your browser menu and choose “Install app” or “Add to Home Screen”.</p>}
    </div>
  </PublicShell>;
}

function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useForm({ defaultValues: { email: '', password: '' } });
  async function submit(values) {
    setBusy(true); setError('');
    try {
      const data = await request('/auth/login', { method: 'POST', body: JSON.stringify(values) });
      localStorage.setItem('nexus-token', data.token);
      localStorage.setItem('nexus-user', JSON.stringify(data.user));
      navigate('/admin');
    } catch (exception) { setError(exception.message); } finally { setBusy(false); }
  }
  return <main className="login-page">
    <section className="login-visual">
      <Brand light />
      <div className="visual-copy"><span className="eyebrow">VE R MOBILITY SOLUTIONS</span><h1>Keeping your<br />workshop moving.</h1><p>Expert installation and dependable after-sales care for the equipment your business relies on.</p><div className="visual-stat"><span className="stat-mark"><Activity size={18} /></span><span><strong>Support at every step</strong><small>Installation, registration and service</small></span><span className="stat-live"><i /> HERE TO HELP</span></div></div>
      <div className="visual-foot"><span>01 / SERVICE PLATFORM</span><span>EST. 2024&nbsp;&nbsp; · &nbsp;&nbsp;INDIA</span></div>
    </section>
    <section className="login-side">
      <div className="mobile-brand"><Brand /></div>
      <div className="login-card"><div className="login-badge"><ShieldCheck size={20} /></div><span className="eyebrow">TEAM PORTAL</span><h2>Welcome back</h2><p className="muted">Sign in to your operations workspace.</p>
        <form onSubmit={form.handleSubmit(submit)} className="form-stack">
          <label className="field-label">Work email<input {...form.register('email', { required: 'Enter your work email.' })} type="email" autoComplete="username" placeholder="you@company.com" /><small className="field-error">{form.formState.errors.email?.message}</small></label>
          <label className="field-label">Password<input {...form.register('password', { required: 'Enter your password.' })} type="password" autoComplete="current-password" placeholder="Your password" /><small className="field-error">{form.formState.errors.password?.message}</small></label>
          {error && <div className="alert-error">{error}</div>}
          <button className="button button-primary button-full" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : 'Sign in to workspace'} {!busy && <ArrowRight size={17} />}</button>
        </form><div className="secure-note"><ShieldCheck size={14} /> Secure, role-based access for your team</div>
      </div>
      <div className="login-footer"><span>© 2026 {brand.name}</span>{brand.supportEmail && <a href={`mailto:${brand.supportEmail}`}>Need help signing in?</a>}</div>
    </section>
  </main>;
}

function EngineerTicketPortal() {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState('');
  const [engineer, setEngineer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('engineer-user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('engineer-token') || '');
  const [tickets, setTickets] = useState([]);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTickets = useCallback(async (authToken) => {
    const data = await request('/engineer/tickets', { headers: { Authorization: `Bearer ${authToken}` } });
    setTickets(data.items);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadTickets(token).catch((exception) => {
      setError(exception.message);
      if (exception.message.includes('session has expired') || exception.message.includes('Sign in')) {
        localStorage.removeItem('engineer-token');
        localStorage.removeItem('engineer-user');
        setToken('');
        setEngineer(null);
      }
    });
  }, [token, loadTickets]);

  async function sendCode() {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/auth/engineer/otp', { method: 'POST', body: JSON.stringify({ mobile }) });
      setOtpSent(true);
      setDevelopmentCode(data.developmentCode || '');
      setNotice(data.message);
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  async function verifyEngineer(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await request('/auth/engineer/verify', { method: 'POST', body: JSON.stringify({ mobile, otp }) });
      localStorage.setItem('engineer-token', data.token);
      localStorage.setItem('engineer-user', JSON.stringify(data.user));
      setEngineer(data.user);
      setToken(data.token);
      setNotice('');
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  async function updateStatus(ticket, status) {
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`/engineer/tickets/${ticket._id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, note: notes[ticket._id] || '' })
      });
      await loadTickets(token);
      setNotes((current) => ({ ...current, [ticket._id]: '' }));
      setNotice(`${ticket.ticketNumber} marked ${status.toLowerCase()}.`);
    } catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }

  function signOut() {
    localStorage.removeItem('engineer-token');
    localStorage.removeItem('engineer-user');
    setToken(''); setEngineer(null); setTickets([]); setOtpSent(false); setOtp(''); setNotice('You have signed out.');
  }

  return <PublicShell label="ENGINEER SERVICE PORTAL">
    <div className="public-intro"><span className="eyebrow">FIELD ENGINEER WORKSPACE</span><h1>Your assigned<br /><em>service calls.</em></h1><p>Verify your engineer account to view assigned requests and update their progress.</p></div>
    <div className="public-card engineer-ticket-card">
      {!token ? <form className="form-stack compact" onSubmit={verifyEngineer}>
        <div className="flow-heading"><span className="step-counter">ENGINEER VERIFICATION</span><strong>Sign in to your assignments</strong></div>
        <label className="field-label">Engineer mobile number<input value={mobile} onChange={(event) => setMobile(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" required /></label>
        {otpSent && <><label className="field-label">6-digit verification code<input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength="6" required /></label>{developmentCode && <div className="info-note">Development OTP: <b>{developmentCode}</b></div>}</>}
        {error && <div className="alert-error" role="alert">{error}</div>}
        {notice && <div className="info-note" role="status">{notice}</div>}
        {!otpSent
          ? <button type="button" className="button button-primary button-full" disabled={busy || !mobile.trim()} onClick={sendCode}>{busy ? 'Sending verification code…' : 'Verify engineer and send code'} <ArrowRight size={16} /></button>
          : <button className="button button-primary button-full" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : 'Verify and view assignments'} <ArrowRight size={16} /></button>}
      </form> : <div className="engineer-ticket-list">
        <div className="engineer-ticket-heading"><div><span className="step-counter">VERIFIED ENGINEER</span><strong>{engineer?.name || 'Your assignments'}</strong></div><button type="button" className="button button-outline button-sm" onClick={signOut}>Sign out</button></div>
        {error && <div className="alert-error" role="alert">{error}</div>}
        {notice && <div className="info-note" role="status">{notice}</div>}
        {!tickets.length ? <div className="empty-state"><ClipboardList size={25} /><b>No assigned requests</b><span>New service calls assigned to you will appear here.</span></div> : tickets.map((ticket) => <article className="engineer-ticket" key={ticket._id}>
          <div className="engineer-ticket-meta"><b>{ticket.ticketNumber}</b><StatusPill status={ticket.status} /></div>
          <h3>{ticket.issueCategory}{ticket.priority === 'High' ? ' · High priority' : ''}</h3>
          <p>{ticket.description}</p>
          <div className="engineer-ticket-machine"><b>{ticket.machine?.machineCode}</b><span>{ticket.machine?.productType || 'Machine'}{ticket.machine?.model ? ` · ${ticket.machine.model}` : ''}</span><span>Customer: {ticket.customer?.name || '—'} · {ticket.customer?.mobile || '—'}</span></div>
          {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && <>
            <label className="field-label">Progress note <span className="optional">OPTIONAL</span><textarea rows="2" maxLength="2000" placeholder="Add a note for the service team" value={notes[ticket._id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [ticket._id]: event.target.value }))} /></label>
            <div className="engineer-ticket-actions">
              {ticket.status !== 'In Progress' && <button type="button" className="button button-outline" disabled={busy} onClick={() => updateStatus(ticket, 'In Progress')}>Start work</button>}
              <button type="button" className="button button-primary" disabled={busy} onClick={() => updateStatus(ticket, 'Resolved')}>Mark resolved <Check size={15} /></button>
            </div>
          </>}
        </article>)}
      </div>}
    </div>
  </PublicShell>;
}

function PublicShell({ children, label = 'MACHINE SUPPORT' }) {
  return <div className="public-page"><header className="public-header"><Brand /><span className="header-label"><span className="online-dot" />{label}</span></header>{children}<footer className="public-footer">{brand.supportPhone ? <>Need a hand? <a href={`tel:${brand.supportPhone.replace(/\s/g, '')}`}>{brand.supportPhone}</a></> : <span>For assistance, contact your machine supplier.</span>}<span> · &nbsp;{brand.name}</span></footer></div>;
}

function MachinePage({ engineerPortal = false, customerPortal = false }) {
  const { machineCode } = useParams();
  const [machine, setMachine] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    setError('');
    request(`/machines/lookup/${encodeURIComponent(machineCode)}`).then((data) => {
      setMachine(data);
      if (data.customerToken) localStorage.setItem(`machine:${data.machine.machineCode}`, data.customerToken);
    }).catch((exception) => setError(exception.message)).finally(() => setLoading(false));
  }, [machineCode, customerPortal, engineerPortal]);
  if (loading) return <PublicShell><div className="public-card center"><PageLoader /></div></PublicShell>;
  if (error) return <PublicShell label="QR CODE HELP"><div className="public-card center"><span className="error-icon"><QrCode size={26} /></span><span className="eyebrow">QR CODE NOT RECOGNIZED</span><h2>We couldn't find this machine</h2><p className="muted">{error}</p>{brand.supportEmail ? <a className="button button-outline" href={`mailto:${brand.supportEmail}`}><CircleHelp size={17} /> Contact support</a> : <p className="muted">Check the code or contact your machine supplier.</p>}</div></PublicShell>;
  const { machine: item, installation, customer } = machine;
  const portalLabel = engineerPortal ? 'ENGINEER INSTALLATION' : customerPortal ? 'CUSTOMER CARE' : 'MACHINE PORTALS';
  const portalContent = !engineerPortal && !customerPortal
    ? <PortalChoice machine={item} />
    : engineerPortal
    ? item.status === 'generated'
      ? <EngineerFlow machine={item} />
      : <div className="flow-wrap"><div className="flow-heading"><span className="step-counter">ENGINEER PORTAL</span><strong>Installation already completed</strong></div><p className="muted">This machine has already been installed. The customer can use the QR code on the machine for registration and service support.</p></div>
    : item.status === 'registered'
      ? <CustomerHome machine={item} customer={customer} />
      : item.status === 'installed'
        ? <RegistrationFlow machine={item} installation={installation} onRegistered={(registeredCustomer) => setMachine((current) => ({ ...current, machine: { ...current.machine, status: 'registered' }, customer: registeredCustomer }))} />
        : <div className="flow-wrap"><div className="flow-heading"><span className="step-counter">CUSTOMER CARE</span><strong>Your machine is getting ready</strong></div><p className="muted">Our installation team will finish setting up this machine before customer registration is available.</p>{brand.supportPhone ? <a className="button button-outline button-full" href={`tel:${brand.supportPhone.replace(/\s/g, '')}`}><CircleHelp size={17} /> Contact support</a> : <p className="muted">For help, contact your machine supplier.</p>}</div>;
  return <PublicShell label={portalLabel}>
    <div className="public-intro"><span className="eyebrow">YOUR EQUIPMENT, CONNECTED</span><h1>Machine care,<br /><em>made simple.</em></h1><p>Machine <b>{item.machineCode}</b>{item.model ? ` · ${item.model}` : ''}</p></div>
    <div className="public-card machine-card">
      <div className="machine-card-head"><span className="machine-icon"><Factory size={20} /></span><span><small>YOUR MACHINE</small><strong>{item.productType || 'Equipment'}{item.model ? ` · ${item.model}` : ''}</strong></span><StatusPill status={item.status} /></div>
      {portalContent}
    </div>
    <div className="privacy-note"><ShieldCheck size={15} /> Your information is securely shared with our support team.</div>
  </PublicShell>;
}

function StatusPill({ status }) {
  const text = { generated: 'Awaiting install', installed: 'Ready to register', registered: 'Registered', Open: 'Open', Assigned: 'Assigned', 'In Progress': 'In progress', Resolved: 'Resolved', Closed: 'Closed' }[status] || status;
  return <span className={`status-pill ${String(status).toLowerCase().replaceAll(' ', '-')}`}><i />{text}</span>;
}

function PortalChoice({ machine }) {
  return <div className="portal-choice">
    <div className="flow-heading"><span className="step-counter">WELCOME</span><strong>Choose your portal</strong></div>
    <p className="muted">Select how you want to continue for this machine.</p>
    <div className="portal-choice-grid">
      <Link className="portal-choice-card engineer-choice" to={`/m/${encodeURIComponent(machine.machineCode)}/engineer`}>
        <span className="portal-choice-icon"><Wrench size={20} /></span>
        <span><strong>Engineer</strong><small>Verify and record the machine installation.</small></span>
        <ArrowRight size={18} />
      </Link>
      <Link className="portal-choice-card customer-choice" to={`/m/${encodeURIComponent(machine.machineCode)}/customer`}>
        <span className="portal-choice-icon"><Smartphone size={20} /></span>
        <span><strong>Customer</strong><small>Register your machine or request service.</small></span>
        <ArrowRight size={18} />
      </Link>
    </div>
  </div>;
}

function Success({ title, text, reference, action }) {
  return <div className="success-panel"><span className="success-check"><Check size={25} /></span><h3>{title}</h3><p>{text}</p>{reference && <div className="reference-box"><small>REFERENCE NUMBER</small><strong>{reference}</strong></div>}{action}</div>;
}

function EngineerFlow({ machine }) {
  const [stage, setStage] = useState('verify');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState('');
  const [token, setToken] = useState('');
  const [done, setDone] = useState(null);
  const [photo, setPhoto] = useState(null);
  const form = useForm({ defaultValues: { mobile: '', otp: '', serialNumber: machine.serialNumber || '', productType: machine.productType || '', model: machine.model || '', installationDate: new Date().toISOString().slice(0, 10), siteAddress: '', customerName: '', customerMobile: '', commissioningNotes: '' } });
  const progress = stage === 'verify' ? 33 : stage === 'details' ? 66 : 100;
  async function sendOtp() {
    if (!/^\+?[0-9\s-]{10,16}$/.test(form.getValues('mobile'))) { setError('Enter a valid engineer mobile number.'); return; }
    setBusy(true); setError('');
    try { const data = await request('/auth/engineer/otp', { method: 'POST', body: JSON.stringify({ mobile: form.getValues('mobile') }) }); setOtpSent(true); setDevelopmentCode(data.developmentCode || ''); }
    catch (exception) { setError(exception.message); } finally { setBusy(false); }
  }
  async function verify(values) {
    setBusy(true); setError('');
    try { const data = await request('/auth/engineer/verify', { method: 'POST', body: JSON.stringify({ mobile: values.mobile, otp: values.otp }) }); setToken(data.token); setStage('details'); }
    catch (exception) { setError(exception.message); } finally { setBusy(false); }
  }
  async function install(values) {
    if (!photo) { setError('Add at least one installation photo before completing the installation.'); return; }
    setBusy(true); setError('');
    try {
      const installationPhoto = await uploadImage(photo, token);
      const data = await request('/installations', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...values, machineCode: machine.machineCode, photos: [installationPhoto], checklist: ['Machine mounted securely', 'Electrical connections checked', 'Safety guards verified', 'Test run completed'].map((label) => ({ label, complete: true })) }) });
      setDone(data.reference); localStorage.removeItem(`install:${machine.machineCode}`);
    } catch (exception) { setError(exception.message); } finally { setBusy(false); }
  }
  useEffect(() => {
    const key = `install:${machine.machineCode}`;
    const subscription = form.watch((values) => localStorage.setItem(key, JSON.stringify(values)));
    const saved = localStorage.getItem(key);
    if (saved) { try { form.reset({ ...form.getValues(), ...JSON.parse(saved) }); } catch { localStorage.removeItem(key); } }
    return () => subscription.unsubscribe();
  }, [machine.machineCode, form]);
  if (done) return <Success title="Installation complete" text="The machine is installed and ready for customer registration." reference={done} />;
  return <div className="flow-wrap"><div className="flow-heading"><span className="step-counter">STEP {stage === 'verify' ? '01' : '02'} OF 02</span><strong>{stage === 'verify' ? 'Engineer verification' : 'Installation details'}</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
    {stage === 'verify' ? <form className="form-stack compact" onSubmit={form.handleSubmit(verify)}>
      <p className="muted">Verify your active engineer mobile number before starting this installation.</p>
      <label className="field-label">Engineer mobile<input {...form.register('mobile', { required: 'Enter your mobile number.' })} inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" /></label>
      {otpSent && <><label className="field-label">6-digit verification code<input {...form.register('otp', { required: 'Enter your verification code.', minLength: 6 })} inputMode="numeric" maxLength="6" placeholder="123456" /></label>{developmentCode && <div className="info-note">Development OTP: <b>{developmentCode}</b></div>}</>}
      {error && <div className="alert-error">{error}</div>}
      {!otpSent ? <button type="button" onClick={sendOtp} className="button button-primary button-full" disabled={busy}>{busy ? 'Sending…' : 'Send verification code'} <ArrowRight size={16} /></button> : <button className="button button-primary button-full" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'} <ArrowRight size={16} /></button>}
    </form> : <form className="form-stack compact" onSubmit={form.handleSubmit(install)}>
      <p className="muted">A few details and your machine will be ready to go.</p>
      <div className="field-grid"><label className="field-label">Serial number<input {...form.register('serialNumber', { required: 'Serial number is required.' })} /></label><label className="field-label">Installation date<input {...form.register('installationDate', { required: true })} type="date" /></label></div>
      <div className="field-grid"><label className="field-label">Product type<input {...form.register('productType', { required: 'Product type is required.' })} /></label><label className="field-label">Model<input {...form.register('model')} /></label></div>
      <label className="field-label">Installation site address<textarea {...form.register('siteAddress', { required: 'Site address is required.' })} rows="2" placeholder="Street, city, state" /></label>
      <div className="field-grid"><label className="field-label">Customer name<input {...form.register('customerName', { required: 'Customer name is required.' })} /></label><label className="field-label">Customer mobile<input {...form.register('customerMobile', { required: 'Mobile is required.' })} inputMode="tel" /></label></div>
      <label className="field-label">Commissioning notes <span className="optional">OPTIONAL</span><textarea {...form.register('commissioningNotes')} rows="2" placeholder="Anything the support team should know?" /></label>
      <label className="field-label upload-label"><span><Smartphone size={17} /> Installation photo <span className="optional">REQUIRED</span></span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required onChange={(event) => setPhoto(event.target.files?.[0] || null)} /> <small>Use your phone camera or choose an image. Images are resized before upload.</small></label>
      {error && <div className="alert-error">{error}</div>}<button className="button button-primary button-full sticky-submit" disabled={busy}>{busy ? 'Saving installation…' : 'Complete installation'} <ArrowRight size={17} /></button>
    </form>}
  </div>;
}

function RegistrationFlow({ machine, installation, onRegistered }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useForm({ defaultValues: { name: installation?.customerName || '', mobile: installation?.customerMobile || '', serialNumber: installation?.serialNumber || machine.serialNumber || '', productType: machine.productType || '', model: machine.model || '', email: '', address: '', dealer: '', purchaseDate: '' } });
  async function submit(values) {
    setBusy(true); setError('');
    try {
      const data = await request('/customers/register', { method: 'POST', body: JSON.stringify({ ...values, machineCode: machine.machineCode }) });
      localStorage.setItem(`machine:${machine.machineCode}`, data.customerToken);
      onRegistered(data.customer);
    } catch (exception) { setError(exception.message); } finally { setBusy(false); }
  }
  return <div className="flow-wrap"><div className="flow-heading"><span className="step-counter">CUSTOMER REGISTRATION</span><strong>Let's make it yours.</strong></div><p className="muted">Confirm your details so our team can give you the right support.</p>
    <form className="form-stack compact" onSubmit={form.handleSubmit(submit)}>
      <label className="field-label">Your name<input {...form.register('name', { required: 'Your name is required.' })} autoComplete="name" placeholder="Full name" /></label>
      <div className="field-grid"><label className="field-label">Mobile number<input {...form.register('mobile', { required: 'Mobile number is required.', pattern: { value: /^\+?[0-9\s-]{10,16}$/, message: 'Enter a valid mobile number.' } })} inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" /></label><label className="field-label">Serial number<input {...form.register('serialNumber', { required: 'Serial number is required.' })} readOnly={Boolean(installation?.serialNumber)} /></label></div>
      <div className="field-grid"><label className="field-label">Email <span className="optional">OPTIONAL</span><input {...form.register('email')} type="email" autoComplete="email" placeholder="you@example.com" /></label><label className="field-label">Purchase date <span className="optional">OPTIONAL</span><input {...form.register('purchaseDate')} type="date" /></label></div>
      <label className="field-label">Address <span className="optional">OPTIONAL</span><textarea {...form.register('address')} rows="2" placeholder="Your address" /></label>
      {error && <div className="alert-error">{error}</div>}<button className="button button-primary button-full sticky-submit" disabled={busy}>{busy ? 'Registering…' : 'Register my machine'} <ArrowRight size={17} /></button>
      <small className="consent">No verification code is required. We use these details to help with future service requests.</small>
    </form>
  </div>;
}

function CustomerHome({ machine, customer }) {
  const [mode, setMode] = useState('home');
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(`machine:${machine.machineCode}`));
  const goTickets = useCallback(async () => {
    try { const data = await request('/tickets/mine', { headers: { Authorization: `Bearer ${token}` } }); setTickets(data.items); setMode('tickets'); }
    catch (exception) { setError(exception.message); }
  }, [token]);
  async function submit(values) {
    setBusy(true); setError('');
    try {
      const key = crypto.randomUUID();
      const data = await request('/tickets', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key }, body: JSON.stringify({ ...values, machineId: machine._id }) });
      setDone(data.ticket.ticketNumber);
    } catch (exception) { setError(exception.message); } finally { setBusy(false); }
  }
  if (!token) return <div className="flow-wrap"><div className="alert-error">Could not open this machine's customer session. Please scan its QR code again.</div></div>;
  if (done) return <Success title="We're on it" text="Your service request is with our team. Keep your reference handy." reference={done} action={<a className="button button-outline button-full" href={`/track/${done}`}>View service tracker <ArrowRight size={16} /></a>} />;
  if (mode === 'new-ticket') return <TicketForm onSubmit={submit} busy={busy} error={error} uploadToken={token} onBack={() => setMode('home')} />;
  if (mode === 'tickets') return <div className="flow-wrap"><button className="text-back" onClick={() => setMode('home')}>← Back to machine</button><div className="flow-heading"><span className="step-counter">SERVICE HISTORY</span><strong>Your requests</strong></div>{error && <div className="alert-error">{error}</div>}{tickets.length === 0 ? <div className="empty-state"><ClipboardList size={25} /><b>No service requests yet</b><span>You're all caught up.</span></div> : tickets.map((ticket) => <a key={ticket.ticketNumber} className="mini-ticket" href={`/track/${ticket.ticketNumber}`}><span><b>{ticket.issueCategory}</b><small>{ticket.ticketNumber} · {new Date(ticket.createdAt).toLocaleDateString('en-IN')}</small></span><StatusPill status={ticket.status} /></a>)}</div>;
  return <div className="flow-wrap"><span className="hello-label">GOOD TO HAVE YOU HERE</span><h2 className="customer-greeting">Hello{customer?.name ? `, ${customer.name.split(' ')[0]}` : ''}<span>!</span></h2><p className="muted">Your machine is registered and connected to our care team.</p><div className="machine-summary"><div className="machine-summary-icon"><Wrench size={19} /></div><span><small>{machine.machineCode}</small><b>{machine.productType || 'Registered machine'}</b><small>{machine.serialNumber ? `S/N ${machine.serialNumber}` : machine.model}</small></span><BadgeCheck size={18} className="green-icon" /></div><button className="button button-primary button-full" onClick={() => setMode('new-ticket')}><Plus size={17} /> Raise a service request</button><button className="button button-soft button-full" onClick={goTickets}><ClipboardList size={17} /> View my service requests <ArrowRight size={16} className="button-end" /></button><div className="support-strip"><CircleHelp size={16} /><span>{brand.supportPhone ? <>Need urgent help? Call <a href={`tel:${brand.supportPhone.replace(/\s/g, '')}`}>{brand.supportPhone}</a></> : 'For urgent help, contact your machine supplier.'}</span></div></div>;
}

function TicketForm({ onSubmit, busy, error, uploadToken, onBack }) {
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const form = useForm({ defaultValues: { issueCategory: 'Not starting', description: '', errorCode: '', priority: 'Medium' } });
  async function submit(values) {
    setUploading(true); setUploadError('');
    try { await onSubmit({ ...values, photos: photo ? [await uploadImage(photo, uploadToken)] : [] }); }
    catch (exception) { setUploadError(exception.message); }
    finally { setUploading(false); }
  }
  return <div className="flow-wrap"><button className="text-back" onClick={onBack}>← Back to machine</button><div className="flow-heading"><span className="step-counter">SERVICE REQUEST</span><strong>How can we help?</strong></div><p className="muted">Tell us what's happening and we'll take it from here.</p><form className="form-stack compact" onSubmit={form.handleSubmit(submit)}>
    <label className="field-label">What's the issue?<select {...form.register('issueCategory', { required: true })}><option>Error code</option><option>Not starting</option><option>Noise</option><option>Performance</option><option>Other</option></select></label>
    <label className="field-label">Describe the problem<textarea {...form.register('description', { required: 'Please add a short description.', minLength: { value: 5, message: 'Please add a little more detail.' } })} rows="4" placeholder="When did it start? What have you noticed?" /><small className="field-error">{form.formState.errors.description?.message}</small></label>
    <div className="field-grid"><label className="field-label">Error code <span className="optional">IF SHOWN</span><input {...form.register('errorCode')} placeholder="e.g. E-104" /></label><label className="field-label">Priority<select {...form.register('priority')}><option>Low</option><option>Medium</option><option>High</option></select></label></div>
    <label className="field-label upload-label"><span><Smartphone size={17} /> Add a photo <span className="optional">OPTIONAL</span></span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /><small>Photos are resized on your phone before upload.</small></label>
    {(error || uploadError) && <div className="alert-error">{error || uploadError}</div>}<button className="button button-primary button-full sticky-submit" disabled={busy || uploading}>{busy || uploading ? 'Submitting request…' : 'Submit service request'} <ArrowRight size={17} /></button>
  </form></div>;
}

function TicketTracker() {
  const { ticketNumber } = useParams();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const token = Object.keys(localStorage).find((key) => key.startsWith('machine:'));
    if (!token) { setError('Open this tracker on the device used to register your machine.'); return; }
    const auth = localStorage.getItem(token);
    request('/tickets/mine', { headers: { Authorization: `Bearer ${auth}` } }).then((data) => setTickets(data.items)).catch((exception) => setError(exception.message));
  }, []);
  const ticket = tickets.find((item) => item.ticketNumber === ticketNumber);
  const steps = ['Open', 'Assigned', 'In Progress', 'Resolved'];
  const active = ticket ? Math.max(0, steps.indexOf(ticket.status)) : 0;
  return <PublicShell label="SERVICE TRACKER"><div className="public-card tracker-card"><span className="eyebrow">YOUR SERVICE REQUEST</span><h2>We're on it.</h2><p className="muted">Ticket <b>{ticketNumber}</b></p>{error && <div className="alert-error">{error}</div>}{ticket && <><div className="timeline">{steps.map((step, index) => <div className={`timeline-step ${index <= active ? 'complete' : ''} ${step === ticket.status ? 'current' : ''}`} key={step}><span className="timeline-dot">{index < active ? <Check size={13} /> : index + 1}</span><span><b>{step}</b><small>{ticket.statusHistory?.find((item) => item.status === step)?.at ? new Date(ticket.statusHistory.find((item) => item.status === step).at).toLocaleString('en-IN') : index === 0 ? new Date(ticket.createdAt).toLocaleString('en-IN') : 'We’ll update this as your request progresses'}</small></span></div>)}</div><div className="tracker-issue"><small>ISSUE REPORTED</small><b>{ticket.issueCategory}</b><p>{ticket.description}</p></div></>}</div></PublicShell>;
}

const navGroups = [
  { label: 'WORKSPACE', links: [{ to: '/admin', title: 'Overview', icon: Gauge, end: true }, { to: '/admin/tickets', title: 'Service tickets', icon: LifeBuoy }, { to: '/admin/machines', title: 'Machines', icon: Factory }, { to: '/admin/installations', title: 'Installations', icon: Wrench }, { to: '/admin/customers', title: 'Customers', icon: Smartphone }] },
  { label: 'MANAGEMENT', links: [{ to: '/admin/qr-codes', title: 'QR generator', icon: QrCode }, { to: '/admin/team', title: 'Team members', icon: ShieldCheck }] }
];

function AdminApp() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus-user')); } catch { return null; } });
  const [mobileNav, setMobileNav] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('nexus-dark') === 'true');
  const navigate = useNavigate();
  useEffect(() => { document.body.classList.toggle('dark-mode', dark); localStorage.setItem('nexus-dark', String(dark)); }, [dark]);
  useEffect(() => {
    if (!localStorage.getItem('nexus-token')) navigate('/login', { replace: true });
    else if (!user) { try { setUser(JSON.parse(localStorage.getItem('nexus-user'))); } catch { navigate('/login', { replace: true }); } }
  }, [navigate, user]);
  function logout() { localStorage.removeItem('nexus-token'); localStorage.removeItem('nexus-user'); navigate('/login'); }
  if (!user) return <PageLoader />;
  return <div className="admin-layout">
    {mobileNav && <button aria-label="Close navigation" className="nav-scrim" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><Brand /></div><div className="workspace-select"><span className="workspace-avatar">{brand.name[0]}</span><span><b>{brand.name}</b><small>Service operations</small></span><ChevronDown size={15} /></div>
      <nav>{navGroups.map((group) => group.label === 'MANAGEMENT' && user.role !== 'admin' ? null : <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.links.map(({ to, title, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileNav(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{title}</span></NavLink>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon"><CircleHelp size={16} /></span><b>Need a hand?</b><small>We’re happy to help.</small>{brand.supportEmail && <a href={`mailto:${brand.supportEmail}`}>Contact support <ArrowRight size={13} /></a>}</div><button className="profile-button" onClick={logout}><span className="profile-avatar">{user.name?.[0] || 'A'}</span><span><b>{user.name}</b><small>{user.role} account</small></span><LogOut size={16} /></button></div>
    </aside>
    <div className="admin-main"><header className="topbar"><div className="topbar-left"><button className="icon-button nav-toggle" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><span className="breadcrumb">Workspace <span>/</span> <b><CurrentSection /></b></span></div><div className="topbar-actions"><span className="topbar-date">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span><button className="icon-button theme-toggle" aria-label="Toggle dark mode" onClick={() => setDark(!dark)}><Moon size={18} /></button><button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><i /></button><span className="topbar-divider" /><button className="top-profile" onClick={logout}><span className="profile-avatar small">{user.name?.[0] || 'A'}</span><ChevronDown size={14} /></button></div></header>
      <div className="admin-content"><Routes><Route index element={<Overview user={user} />} /><Route path="tickets" element={<DataPage type="tickets" title="Service tickets" description="Review, assign and track customer requests." />} /><Route path="machines" element={<DataPage type="machines" title="Machines" description="Every machine in your connected fleet." />} /><Route path="installations" element={<DataPage type="installations" title="Installations" description="Field installation records from your team." />} /><Route path="customers" element={<DataPage type="customers" title="Customers" description="Customers and registered equipment." />} /><Route path="qr-codes" element={user.role === 'admin' ? <QRGenerator /> : <Navigate to="/admin" replace />} /><Route path="team" element={user.role === 'admin' ? <TeamPage /> : <Navigate to="/admin" replace />} /><Route path="*" element={<NotFound />} /></Routes></div>
      <footer className="admin-footer"><span>© 2026 {brand.name}</span><span><i /> All systems operational <span className="footer-sep">·</span> v1.0.0</span></footer>
    </div>
  </div>;
}

function CurrentSection() {
  const { pathname } = useLocationShim();
  return pathname.split('/').filter(Boolean).at(-1)?.replace('-', ' ').replace(/^\w/, (letter) => letter.toUpperCase()) || 'Overview';
}
function useLocationShim() { return { pathname: window.location.pathname }; }

function Overview({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { request('/dashboard').then(setData).catch((exception) => setError(exception.message)); }, []);
  const stats = [
    { label: 'Total machines', key: 'machines', icon: Factory, tint: 'mint', delta: 'Across your fleet', trend: 'up' },
    { label: 'Installed', key: 'installed', icon: Wrench, tint: 'blue', delta: 'Ready to register', trend: 'up' },
    { label: 'Registered', key: 'registered', icon: BadgeCheck, tint: 'purple', delta: 'Customer connected', trend: 'up' },
    { label: 'Open tickets', key: 'openTickets', icon: LifeBuoy, tint: 'amber', delta: 'Need attention', trend: 'down' },
    { label: 'Resolved this month', key: 'resolvedThisMonth', icon: Check, tint: 'green', delta: 'Customer requests', trend: 'up' }
  ];
  const activity = data?.ticketActivity || [];
  const issueCategories = data?.issueCategories || [];
  const installationsByMonth = data?.installationsByMonth || [];
  const maxActivity = Math.max(1, ...activity.map((week) => week.count));
  const maxCategoryCount = Math.max(1, ...issueCategories.map((item) => item.count));
  const maxMonthlyInstallations = Math.max(1, ...installationsByMonth.map((item) => item.count));
  const ticketTotal = activity.reduce((total, week) => total + week.count, 0);
  const registeredRatio = data ? (data.stats.registered / Math.max(1, data.stats.machines)) * 100 : 0;
  const installedRatio = data ? (data.stats.installed / Math.max(1, data.stats.machines)) * 100 : 0;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
  return <div className="overview-page"><div className="page-heading"><div><span className="eyebrow">{today}</span><h1>Good morning, {user.name?.split(' ')[0] || 'there'} <span className="greeting-spark">✳</span></h1><p>Here’s what’s happening across your service operations.</p></div><a className="button button-primary" href="/admin/qr-codes"><Plus size={17} /> Generate QR codes</a></div>
    {error && <div className="alert-error">{error}</div>}
    <div className="metric-grid">{stats.map(({ label, key, icon: Icon, tint, delta, trend }) => <article className="metric-card" key={key}><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tint}`}><Icon size={18} /></span></div><strong className="metric-number">{data ? data.stats[key].toLocaleString() : <span className="skeleton" />}</strong><div className="metric-foot"><span className={`trend ${trend}`}><ArrowUpRight size={13} /> {delta}</span><span>current total</span></div></article>)}</div>
    <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">SERVICE ACTIVITY</span><h2>Ticket volume</h2></div><span className="select-compact">Last 6 weeks</span></div><div className="chart-summary"><strong>{ticketTotal}</strong><small>tickets in the last six weeks</small></div><div className="chart-area"><div className="chart-y"><span>{maxActivity}</span><span>{Math.ceil(maxActivity * .75)}</span><span>{Math.ceil(maxActivity * .5)}</span><span>{Math.ceil(maxActivity * .25)}</span><span>0</span></div><div className="bar-chart">{activity.map((week, index) => <div className={`bar-wrap ${index === activity.length - 1 ? 'highlight' : ''}`} key={week.startDate}><i style={{ height: `${Math.max(3, (week.count / maxActivity) * 100)}%` }} title={`${week.count} tickets`} /></div>)}</div></div><div className="chart-x">{activity.map((week) => <span key={week.startDate}>{new Date(week.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>)}</div></section>
      <section className="panel health-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR FLEET</span><h2>Machine health</h2></div><button className="icon-button" aria-label="Machine details"><ArrowUpRight size={16} /></button></div><div className="health-visual"><div className="health-donut" style={{ background: `conic-gradient(#57956d 0 ${registeredRatio}%, #dfb65b ${registeredRatio}% ${registeredRatio + installedRatio}%, #e7eee9 ${registeredRatio + installedRatio}% 100%)` }}><div><strong>{data ? Math.round(registeredRatio) : '—'}<small>%</small></strong><span>REGISTERED</span></div></div></div><div className="health-legend"><span><i className="dot-green" />Registered <b>{data?.stats.registered ?? '—'}</b></span><span><i className="dot-gray" />Awaiting install <b>{data ? Math.max(0, data.stats.machines - data.stats.registered - data.stats.installed) : '—'}</b></span><span><i className="dot-gold" />Installed <b>{data?.stats.installed ?? '—'}</b></span></div><a className="panel-link" href="/admin/machines">View all machines <ArrowRight size={14} /></a></section>
    </div>
    <div className="dashboard-insights">
      <section className="panel insight-chart-panel"><div className="panel-heading"><div><span className="eyebrow">SERVICE BREAKDOWN</span><h2>Tickets by issue category</h2></div></div><div className="category-chart">{issueCategories.map((item) => <div className="category-row" key={item.category}><span>{item.category}</span><div className="category-track"><i style={{ width: `${(item.count / maxCategoryCount) * 100}%` }} /></div><b>{item.count}</b></div>)}</div></section>
      <section className="panel insight-chart-panel"><div className="panel-heading"><div><span className="eyebrow">INSTALLATION TREND</span><h2>Installations per month</h2></div><span className="select-compact">Last 6 months</span></div><div className="monthly-chart">{installationsByMonth.map((item) => <div className="monthly-column" key={item.month}><b>{item.count}</b><i style={{ height: `${item.count ? Math.max(6, (item.count / maxMonthlyInstallations) * 100) : 0}%` }} title={`${item.count} installations`} /><span>{new Date(`${item.month}-01T12:00:00+05:30`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}</span></div>)}</div></section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">LATEST ACTIVITY</span><h2>Recent service tickets</h2></div><a href="/admin/tickets" className="panel-link">All tickets <ArrowRight size={14} /></a></div><TicketTable tickets={data?.recentTickets || []} loading={!data && !error} /></section>
    <div className="overview-bottom"><div className="response-card"><span className="response-icon"><Activity size={18} /></span><span><b>You're making a difference.</b><small>Your support team resolved <strong>{data?.stats.resolvedThisMonth ?? '—'} service requests</strong> this month.</small></span><ArrowUpRight size={19} /></div><div className="insight-card"><span className="insight-icon"><FileSpreadsheet size={17} /></span><span><b>Ready for your monthly review?</b><small>Download your latest service data.</small></span><ExportButton type="tickets" compact /></div></div>
  </div>;
}

function TicketTable({ tickets = [], loading = false }) {
  return <div className="table-scroll"><table><thead><tr><th>TICKET</th><th>CUSTOMER</th><th>MACHINE</th><th>ISSUE</th><th>PRIORITY</th><th>STATUS</th><th>REPORTED</th></tr></thead><tbody>{loading ? Array.from({ length: 4 }, (_, index) => <tr key={index}><td colSpan="7"><span className="skeleton skeleton-row" /></td></tr>) : tickets.length ? tickets.map((ticket) => <tr key={ticket._id}><td><b className="ticket-id">{ticket.ticketNumber}</b></td><td><span className="customer-cell"><i>{ticket.customer?.name?.[0] || 'C'}</i><b>{ticket.customer?.name || 'Customer'}</b></span></td><td>{ticket.machine?.machineCode}</td><td>{ticket.issueCategory}</td><td><span className={`priority priority-${ticket.priority?.toLowerCase()}`}><i />{ticket.priority}</span></td><td><StatusPill status={ticket.status} /></td><td>{new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td></tr>) : <tr><td colSpan="7"><div className="empty-state table-empty"><ClipboardList size={23} /><b>No service tickets yet</b><span>Customer requests will show up here.</span></div></td></tr>}</tbody></table></div>;
}

function ExportButton({ type, search = '', status = '', compact = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function exportData() {
    setBusy(true); setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const query = params.size ? `?${params}` : '';
    try { await downloadFile(`/export/${type}${query}`, `${type}.xlsx`); }
    catch (exception) { setError(exception.message); }
    finally { setBusy(false); }
  }
  return <span className={compact ? 'export-control compact' : 'export-control'}>
    <button type="button" className="button button-outline" onClick={exportData} disabled={busy}>
      <Download size={16} /> {busy ? 'Preparing…' : 'Export to Excel'}
    </button>
    {error && <small className="field-error">{error}</small>}
  </span>;
}

function DataPage({ type, title, description }) {
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [whatsappNotification, setWhatsappNotification] = useState(null);
  const [selected, setSelected] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [assignmentOptions, setAssignmentOptions] = useState({ serviceUsers: [], engineers: [] });
  const [assignment, setAssignment] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const load = useCallback(() => {
    setBusy(true); setError('');
    const params = new URLSearchParams({ page, limit: 10 });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    request(`/${type}?${params}`).then(setData).catch((exception) => setError(exception.message)).finally(() => setBusy(false));
  }, [type, page, search, status]);
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (type === 'tickets') request('/assignment-options').then(setAssignmentOptions).catch((exception) => setError(exception.message));
  }, [type]);
  const exportType = type === 'machines' ? 'machine-master' : type;
  const columns = type === 'tickets' ? ['Ticket', 'Customer', 'Machine', 'Issue', 'Priority', 'Status', 'Assigned to', 'Reported'] : type === 'machines' ? ['Machine code', 'Product', 'Model', 'Serial number', 'Status', 'Created'] : type === 'customers' ? ['Customer', 'Mobile', 'Email', 'Machine', 'Registered'] : ['Machine', 'Serial number', 'Customer', 'Engineer', 'Installation date'];
  function rowCells(row) {
    if (type === 'tickets') return [<b className="ticket-id">{row.ticketNumber}</b>, row.customer?.name, row.machine?.machineCode, row.issueCategory, <span className={`priority priority-${row.priority?.toLowerCase()}`}><i />{row.priority}</span>, <StatusPill status={row.status} />, row.assignedEngineer?.name || row.assignedTo?.name || 'Unassigned', new Date(row.createdAt).toLocaleDateString('en-IN')];
    if (type === 'machines') return [<b>{row.machineCode}</b>, row.productType || '—', row.model || '—', row.serialNumber || '—', <StatusPill status={row.status} />, new Date(row.createdAt).toLocaleDateString('en-IN')];
    if (type === 'customers') return [<b>{row.name}</b>, row.mobile, row.email || '—', row.machine?.machineCode, new Date(row.createdAt).toLocaleDateString('en-IN')];
    return [row.machine?.machineCode, row.serialNumber, row.customerName, row.engineerName || '—', new Date(row.installationDate).toLocaleDateString('en-IN')];
  }
  async function openTicket(row) {
    setSelected(row);
    setTicketDetail(null);
    setTicketError('');
    setTicketBusy(true);
    try {
      const detail = await request(`/tickets/${row._id}`);
      setTicketDetail(detail);
      setAssignment(detail.ticket.assignedEngineer?._id
        ? `engineer:${detail.ticket.assignedEngineer._id}`
        : detail.ticket.assignedTo?._id ? `service:${detail.ticket.assignedTo._id}` : '');
      setResolutionNotes(detail.ticket.resolutionNotes || '');
      setInternalNote('');
    } catch (exception) { setTicketError(exception.message); }
    finally { setTicketBusy(false); }
  }
  async function updateTicket() {
    if (!ticketDetail) return;
    try {
      const payload = {
        status: ticketDetail.ticket.status,
        assignedTo: assignment.startsWith('service:') ? assignment.slice('service:'.length) : null,
        assignedEngineer: assignment.startsWith('engineer:') ? assignment.slice('engineer:'.length) : null,
        internalNote,
        resolutionNotes
      };
      const result = await request(`/tickets/${selected._id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setSelected(null); setTicketDetail(null);
      setWhatsappNotification(result.engineerNotification?.whatsappUrl
        ? { url: result.engineerNotification.whatsappUrl, engineerName: result.ticket.assignedEngineer?.name || 'engineer' }
        : null);
      setToast(result.engineerNotification && !result.engineerNotification.sent
        ? `Ticket updated. ${result.engineerNotification.message}`
        : result.engineerNotification?.sent ? 'Ticket updated and engineer notified.' : 'Ticket updated.');
      load(); setTimeout(() => setToast(''), 6000);
    } catch (exception) { setError(exception.message); }
  }
  const statuses = type === 'tickets' ? ['', 'Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'] : type === 'machines' ? ['', 'generated', 'installed', 'registered'] : [];
  return <div className="data-page"><div className="page-heading"><div><span className="eyebrow">OPERATIONS</span><h1>{title}</h1><p>{description}</p></div><ExportButton type={exportType} search={search} status={status} /></div>
    <section className="panel data-panel"><div className="data-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${type}…`} /></div><div className="toolbar-actions">{statuses.length > 0 && <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}</select>}<span className="result-count">{data.total} records</span></div></div>
      {error && <div className="alert-error table-alert">{error}</div>}
      <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}{type === 'tickets' && <th />}</tr></thead><tbody>{busy ? Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={columns.length + 1}><span className="skeleton skeleton-row" /></td></tr>) : data.items.length ? data.items.map((row) => <tr key={row._id} className={type === 'tickets' ? 'clickable-row' : ''} onClick={() => type === 'tickets' && openTicket(row)}>{rowCells(row).map((cell, i) => <td key={i}>{cell}</td>)}{type === 'tickets' && <td><ArrowUpRight size={15} className="table-action-icon" /></td>}</tr>) : <tr><td colSpan={columns.length + 1}><div className="empty-state table-empty"><ClipboardList size={23} /><b>Nothing to show just yet</b><span>Try adjusting your filters or search.</span></div></td></tr>}</tbody></table></div>
      <div className="pagination"><span>Showing {data.total ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, data.total)} of {data.total}</span><div><button className="button button-outline button-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="page-number">{page}</span><button className="button button-outline button-sm" disabled={page * 10 >= data.total} onClick={() => setPage(page + 1)}>Next</button></div></div>
    </section>{toast && <div className="toast"><Check size={16} /><span>{toast}</span>{whatsappNotification && <a className="toast-action" href={whatsappNotification.url} target="_blank" rel="noreferrer">Send to {whatsappNotification.engineerName} on WhatsApp</a>}</div>}
    {selected && <div className="ticket-detail" onClick={() => { setSelected(null); setTicketDetail(null); }}><section className="ticket-detail-card" onClick={(event) => event.stopPropagation()}><div className="ticket-detail-head"><div><span className="eyebrow">TICKET DETAILS</span><h2>{selected.ticketNumber}</h2></div><button className="icon-button" onClick={() => { setSelected(null); setTicketDetail(null); }} aria-label="Close"><X size={19} /></button></div>
      {ticketError && <div className="alert-error">{ticketError}</div>}
      {ticketBusy && <PageLoader />}
      {ticketDetail && <>
        <div className="ticket-detail-summary"><span><small>CUSTOMER</small><b>{ticketDetail.ticket.customer?.name}</b><small>{ticketDetail.ticket.customer?.mobile}</small></span><span><small>MACHINE</small><b>{ticketDetail.machineHistory.machine.machineCode}</b><small>{ticketDetail.machineHistory.machine.productType} · {ticketDetail.machineHistory.machine.model || '—'}</small></span><span><small>ISSUE</small><b>{ticketDetail.ticket.issueCategory}</b><small>{ticketDetail.ticket.priority} priority</small></span></div>
        <div className="ticket-description"><span className="eyebrow">CUSTOMER DESCRIPTION</span><p>{ticketDetail.ticket.description}</p>{ticketDetail.ticket.errorCode && <small>Error code: {ticketDetail.ticket.errorCode}</small>}</div>
        {ticketDetail.ticket.photos?.length > 0 && <div className="ticket-photos">{ticketDetail.ticket.photos.map((photo) => <a href={photo.url} target="_blank" rel="noreferrer" key={photo.url}><img src={photo.url} alt="Customer-submitted issue" loading="lazy" /></a>)}</div>}
        <div className="detail-edit-grid"><label className="field-label">Status<select value={ticketDetail.ticket.status} onChange={(event) => setTicketDetail({ ...ticketDetail, ticket: { ...ticketDetail.ticket, status: event.target.value } })}>{['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="field-label">Assign to<select value={assignment} onChange={(event) => setAssignment(event.target.value)}><option value="">Unassigned</option><optgroup label="Field engineers">{assignmentOptions.engineers.map((person) => <option value={`engineer:${person._id}`} key={`engineer-${person._id}`}>{person.name} · {person.mobile}</option>)}</optgroup><optgroup label="Service team">{assignmentOptions.serviceUsers.map((person) => <option value={`service:${person._id}`} key={`service-${person._id}`}>{person.name}</option>)}</optgroup></select></label></div>
        <label className="field-label">Internal note <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} maxLength={2000} rows="2" placeholder="Add an internal update for the service team" /></label>
        <label className="field-label">Resolution notes <textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} maxLength={3000} rows="2" placeholder="Record how this issue was resolved" /></label>
        <div className="detail-section"><span className="eyebrow">STATUS TIMELINE</span><div className="audit-list">{ticketDetail.ticket.statusHistory?.map((entry, index) => <div className="audit-entry" key={`${entry.status}-${entry.at}-${index}`}><i /><span><b>{entry.status}</b><small>{entry.changedBy} · {new Date(entry.at).toLocaleString('en-IN')}</small></span></div>)}</div></div>
        {ticketDetail.ticket.auditTrail?.length > 0 && <div className="detail-section"><span className="eyebrow">INTERNAL AUDIT & NOTES</span><div className="audit-list">{ticketDetail.ticket.auditTrail.map((entry, index) => <div className="audit-entry" key={`${entry.action}-${entry.at}-${index}`}><i /><span><b>{entry.action === 'note' ? 'Internal note' : entry.action === 'assignment' ? 'Assignment' : entry.action === 'resolution' ? 'Resolution' : entry.action}</b><small>{entry.message}</small><small>{entry.changedBy} · {new Date(entry.at).toLocaleString('en-IN')}</small></span></div>)}</div></div>}
        <div className="detail-section"><span className="eyebrow">MACHINE HISTORY</span><div className="machine-history">{ticketDetail.machineHistory.installation ? <article><b>Installation</b><small>{new Date(ticketDetail.machineHistory.installation.installationDate).toLocaleDateString('en-IN')} · {ticketDetail.machineHistory.installation.engineerName || 'Engineer'}</small><small>{ticketDetail.machineHistory.installation.siteAddress}</small></article> : <article><b>No installation record</b></article>}{ticketDetail.machineHistory.customer && <article><b>Customer registration</b><small>{ticketDetail.machineHistory.customer.name} · {ticketDetail.machineHistory.customer.mobile}</small></article>}{ticketDetail.machineHistory.tickets.map((item) => <article key={item._id}><b>{item.ticketNumber} · {item.issueCategory}</b><small>{item.status} · {new Date(item.createdAt).toLocaleDateString('en-IN')}</small></article>)}</div></div>
        <div className="ticket-detail-actions"><button className="button button-outline" onClick={() => { setSelected(null); setTicketDetail(null); }}>Close</button><button className="button button-primary" onClick={updateTicket}><Check size={15} /> Save ticket updates</button></div>
      </>}
    </section></div>}
  </div>;
}

function QRGenerator() {
  const [quantity, setQuantity] = useState(12);
  const [productType, setProductType] = useState('');
  const [model, setModel] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function generate(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const data = await request('/machines/generate', { method: 'POST', body: JSON.stringify({ quantity: Number(quantity), productType, model }) }); setItems(data.machines); }
    catch (exception) { setError(exception.message); } finally { setBusy(false); }
  }
  return <div className="data-page"><div className="page-heading"><div><span className="eyebrow">MACHINE MANAGEMENT</span><h1>QR code generator</h1><p>Create unique, scan-ready identifiers for your equipment.</p></div></div><div className="qr-layout"><section className="panel qr-form-panel"><div className="qr-emblem"><QrCode size={25} /></div><h2>Generate machine codes</h2><p className="muted">Each code links directly to installation, registration and service support.</p><form className="form-stack" onSubmit={generate}><label className="field-label">Number of machines<input type="number" min="1" max="500" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /><small>Generate between 1 and 500 codes at once.</small></label><label className="field-label">Product type <span className="optional">OPTIONAL</span><input value={productType} onChange={(event) => setProductType(event.target.value)} placeholder="e.g. Hydraulic lift" /></label><label className="field-label">Model <span className="optional">OPTIONAL</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="e.g. NL-4000" /></label>{error && <div className="alert-error">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? 'Generating codes…' : <><QrCode size={17} /> Generate {quantity} codes</>}</button></form></section><section className="qr-explainer"><span className="eyebrow">HOW IT WORKS</span><h2>One scan.<br /><em>Every next step.</em></h2><div className="qr-steps"><span><i>01</i><b>Print & attach</b><small>Each QR code is unique to one machine.</small></span><span><i>02</i><b>Install & register</b><small>Engineers and customers scan the same code.</small></span><span><i>03</i><b>Stay connected</b><small>Customers can request service any time.</small></span></div></section></div>
    {items.length > 0 && <section className="panel generated-panel"><div className="panel-heading"><div><span className="eyebrow">READY TO PRINT</span><h2>{items.length} machine codes generated</h2></div><div className="qr-download-actions"><button className="button button-outline" onClick={() => window.print()}><Download size={16} /> Print sticker sheet</button><button className="button button-outline" onClick={() => downloadFile(`/machines/qr.pdf?ids=${items.map((item) => item.id).join(',')}`, 'machine-qr-sticker-sheet.pdf').catch((exception) => setError(exception.message))}><FileSpreadsheet size={16} /> Download PDF</button><button className="button button-outline" onClick={() => downloadFile(`/machines/qr.zip?ids=${items.map((item) => item.id).join(',')}`, 'machine-qr-codes.zip').catch((exception) => setError(exception.message))}><Download size={16} /> Download PNG ZIP</button></div></div><div className="qr-grid">{items.map((item) => <article className="qr-card" key={item.machineCode}><img src={`/api/qr/${item.machineCode}.png`} alt={`QR code ${item.machineCode}`} /><b>{item.machineCode}</b><small>SCAN FOR INSTALLATION & SERVICE</small></article>)}</div></section>}
  </div>;
}

function TeamPage() {
  const [team, setTeam] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'service' });
  const [engineerForm, setEngineerForm] = useState({ name: '', mobile: '' });
  const [toast, setToast] = useState('');
  const refresh = useCallback(() => Promise.all([request('/users').then((data) => setTeam(data.items)), request('/engineers').then((data) => setEngineers(data.items))]).catch((exception) => setError(exception.message)), []);
  useEffect(() => { refresh(); }, [refresh]);
  async function addUser(event) {
    event.preventDefault(); setError('');
    try { await request('/users', { method: 'POST', body: JSON.stringify(form) }); setForm({ name: '', email: '', password: '', role: 'service' }); setToast('Team member added.'); refresh(); setTimeout(() => setToast(''), 2500); }
    catch (exception) { setError(exception.message); }
  }
  async function addEngineer(event) {
    event.preventDefault(); setError('');
    try { await request('/engineers', { method: 'POST', body: JSON.stringify(engineerForm) }); setEngineerForm({ name: '', mobile: '' }); setToast('Engineer added.'); refresh(); setTimeout(() => setToast(''), 2500); }
    catch (exception) { setError(exception.message); }
  }
  return <div className="data-page"><div className="page-heading"><div><span className="eyebrow">ACCESS MANAGEMENT</span><h1>Your team</h1><p>Manage the people who keep every machine moving.</p></div></div>{error && <div className="alert-error">{error}</div>}<div className="team-grid"><section className="panel team-panel"><div className="panel-heading"><div><span className="eyebrow">BACK OFFICE</span><h2>Service & admin users</h2></div></div><form className="team-add-form" onSubmit={addUser}><input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input required type="email" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required minLength="12" type="password" placeholder="Password (12+ chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="service">Service</option><option value="admin">Admin</option></select><button className="button button-primary button-sm"><Plus size={15} /> Add</button></form><div className="team-list">{team.map((person) => <div className="team-row" key={person._id}><span className="profile-avatar">{person.name[0]}</span><span><b>{person.name}</b><small>{person.email}</small></span><span className="role-pill">{person.role}</span></div>)}</div></section><section className="panel team-panel"><div className="panel-heading"><div><span className="eyebrow">FIELD TEAM</span><h2>Installation engineers</h2></div></div><form className="team-add-form engineer-add" onSubmit={addEngineer}><input required placeholder="Engineer name" value={engineerForm.name} onChange={(e) => setEngineerForm({ ...engineerForm, name: e.target.value })} /><input required inputMode="tel" placeholder="Mobile number" value={engineerForm.mobile} onChange={(e) => setEngineerForm({ ...engineerForm, mobile: e.target.value })} /><button className="button button-primary button-sm"><Plus size={15} /> Add</button></form><div className="team-list">{engineers.map((person) => <div className="team-row" key={person._id}><span className="profile-avatar engineer-avatar">{person.name[0]}</span><span><b>{person.name}</b><small>{person.mobile}</small></span><span className={`role-pill ${person.active ? 'active-role' : ''}`}>{person.active ? 'Active' : 'Inactive'}</span></div>)}</div></section></div>{toast && <div className="toast"><Check size={16} />{toast}</div>}</div>;
}

function NotFound() { return <PublicShell label="PAGE NOT FOUND"><div className="public-card center"><span className="error-icon"><CircleHelp size={27} /></span><span className="eyebrow">404 — LOST IN THE WORKSHOP?</span><h2>This page took a wrong turn.</h2><p className="muted">The link may have expired, or the page has moved.</p><a href="/login" className="button button-primary">Back to team portal <ArrowRight size={16} /></a></div></PublicShell>; }
