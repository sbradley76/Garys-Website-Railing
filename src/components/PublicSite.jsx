import { useEffect, useState } from 'react';
import { PROJECTS, SERVICES, SITE } from '../config/site';
import Icon from './Icon';

const FAQS = [
  ['What information helps you price a commercial project?', 'Plans, elevations, specifications, approximate linear footage, material preferences, site address, target schedule, and any access or phasing constraints are the best starting point.'],
  ['Can you work from incomplete drawings?', 'Yes. Early budgeting requests are welcome. We can identify missing details, provide allowances where appropriate, and refine the quote as the design develops.'],
  ['Do you handle occupied properties and phased work?', 'Yes. The project request form includes phasing and site-visit details so we can discuss access, resident or guest impact, sequencing, and temporary protection early.'],
  ['What types of customers do you work with?', 'General contractors, developers, property managers, condominium associations, hospitality groups, municipalities, industrial operators, and commercial owners.'],
  ['Can you repair an existing railing or fence?', 'Often, yes. We evaluate the existing system, damage, finish, anchorage, code implications, and replacement availability before recommending repair, retrofit, or replacement.'],
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function PublicSite({ openQuote, openManager }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState('All');
  const [faqOpen, setFaqOpen] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('revealed'));
    }, { threshold: 0.14 });
    document.querySelectorAll('[data-reveal]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveTestimonial((current) => (current + 1) % 3), 6500);
    return () => window.clearInterval(timer);
  }, []);

  const filteredProjects = galleryFilter === 'All' ? PROJECTS : PROJECTS.filter((project) => project.category === galleryFilter);
  const navItems = [['home', 'Home'], ['services', 'Capabilities'], ['about', 'About'], ['portfolio', 'Portfolio'], ['contact', 'Contact']];
  const testimonials = [
    { quote: 'The strongest trade partners communicate early, understand the drawings, and keep the field team informed. That is the standard this company is built around.', name: 'Commercial GC', role: 'Placeholder testimonial' },
    { quote: 'Clear scope, realistic scheduling, and dependable closeout matter just as much as the finished railing. The entire process should feel controlled.', name: 'Property Manager', role: 'Placeholder testimonial' },
    { quote: 'From budgeting through installation, commercial work needs a partner who can respond quickly and document the details.', name: 'Developer', role: 'Placeholder testimonial' },
  ];

  return (
    <div className="site-shell">
      <div className="top-strip"><span>Commercial railing · fencing · gates · repairs</span><a href={`tel:${SITE.phoneHref}`}><Icon name="phone" size={15} /> {SITE.phoneDisplay}</a></div>
      <header className="site-header">
        <a className="brand" href="#home" onClick={() => setMenuOpen(false)} aria-label={`${SITE.businessName} home`}>
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>{SITE.shortName}</strong><small>Commercial Rail & Fence</small></span>
        </a>
        <nav className={menuOpen ? 'main-nav open' : 'main-nav'} aria-label="Primary navigation">
          {navItems.map(([id, label]) => <button key={id} onClick={() => { setMenuOpen(false); scrollTo(id); }}>{label}</button>)}
          <button className="nav-quote" onClick={() => { setMenuOpen(false); openQuote(); }}>Request a quote <Icon name="arrow" size={17} /></button>
        </nav>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-content" data-reveal>
            <p className="eyebrow light">Commercial exterior systems</p>
            <h1>Railing and fence work that <em>holds the line.</em></h1>
            <p className="hero-copy">Built for contractors, developers, property managers, and commercial owners who need clear communication, durable installations, and a partner who understands schedule pressure.</p>
            <div className="hero-actions">
              <button className="button button-accent" onClick={openQuote}>Start a project request <Icon name="arrow" /></button>
              <button className="button button-outline-light" onClick={() => scrollTo('portfolio')}>View project types</button>
            </div>
            <div className="hero-proof">
              <span><Icon name="shield" /> Commercial-first approach</span>
              <span><Icon name="ruler" /> Plan and field coordination</span>
              <span><Icon name="clock" /> Responsive estimating</span>
            </div>
          </div>
          <div className="hero-visual" data-reveal>
            <img src="/images/hero-railing.svg" alt="Placeholder rendering of commercial balcony railings" />
            <div className="hero-card hero-card-top"><span>Project focus</span><strong>Commercial & multifamily</strong></div>
            <div className="hero-card hero-card-bottom"><b>01</b><span>From concept and budgeting<br/>through installation.</span></div>
          </div>
          <button className="scroll-cue" onClick={() => scrollTo('services')}><span>Explore</span><i /></button>
        </section>

        <section className="proof-bar" aria-label="Company highlights">
          <div><strong>Commercial</strong><span>Dedicated project focus</span></div>
          <div><strong>Responsive</strong><span>Clear estimating workflow</span></div>
          <div><strong>Flexible</strong><span>New build, retrofit, repair</span></div>
          <div><strong>Regional</strong><span>Northwest Florida and beyond</span></div>
        </section>

        <section className="section services-section" id="services">
          <div className="section-heading split" data-reveal>
            <div><p className="eyebrow">Capabilities</p><h2>One partner for the systems that define and protect the property.</h2></div>
            <p>Simple scopes and complex bid packages receive the same thing: a direct response, a clear next step, and practical attention to field conditions.</p>
          </div>
          <div className="services-grid">
            {SERVICES.map((service) => (
              <article className="service-card" key={service.id} data-reveal>
                <div className="service-number">{service.number}</div>
                <div className="service-icon"><span /><span /><span /></div>
                <h3>{service.title}</h3>
                <p>{service.copy}</p>
                <div className="tag-row">{service.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                <button onClick={openQuote}>Discuss this scope <Icon name="arrow" size={18} /></button>
              </article>
            ))}
          </div>
        </section>

        <section className="section about-section" id="about">
          <div className="about-media" data-reveal>
            <img src="/images/about-team.svg" alt="Placeholder commercial railing project coordination scene" />
            <div className="media-label"><span>Built around</span><strong>Field reality</strong></div>
          </div>
          <div className="about-copy" data-reveal>
            <p className="eyebrow">About the company</p>
            <h2>Commercial work needs more than a good-looking finished product.</h2>
            <p className="lead-copy">It needs a trade partner who understands drawings, site access, sequencing, code-sensitive details, occupied properties, and the cost of unanswered questions.</p>
            <p>{SITE.businessName} is positioned to support commercial railing, fencing, gate, and retrofit projects with a practical, accountable process from first conversation through closeout.</p>
            <div className="about-points">
              <div><Icon name="check"/><span><strong>Clear scope review</strong><small>Identify assumptions and missing information before they become field problems.</small></span></div>
              <div><Icon name="check"/><span><strong>Built for coordination</strong><small>Work with owners, GCs, property teams, designers, and site contacts.</small></span></div>
              <div><Icon name="check"/><span><strong>Project-minded communication</strong><small>Document decisions, follow up, and keep next actions visible.</small></span></div>
            </div>
            <button className="text-link" onClick={openQuote}>Tell us about your project <Icon name="arrow" /></button>
          </div>
        </section>

        <section className="process-section">
          <div className="section process-inner">
            <div className="section-heading centered-heading" data-reveal><p className="eyebrow light">How it works</p><h2>A straightforward path from request to field work.</h2></div>
            <div className="process-grid">
              {[
                ['01', 'Share the scope', 'Send the project type, location, timeline, photos, plans, and approximate quantities.'],
                ['02', 'Confirm the details', 'We review the request, identify missing information, and coordinate a call or site visit.'],
                ['03', 'Build the quote', 'The estimate documents scope, assumptions, material direction, schedule, and next steps.'],
                ['04', 'Plan the work', 'Once approved, the project moves into scheduling, coordination, installation, and closeout.'],
              ].map(([number, title, copy]) => <article key={number} data-reveal><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
            </div>
          </div>
        </section>

        <section className="section portfolio-section" id="portfolio">
          <div className="section-heading split" data-reveal>
            <div><p className="eyebrow">Gallery / portfolio</p><h2>Project categories built for commercial properties.</h2></div>
            <div className="gallery-filters">{['All', 'Railing', 'Fencing', 'Gates', 'Repairs'].map((filter) => <button className={galleryFilter === filter ? 'active' : ''} key={filter} onClick={() => setGalleryFilter(filter)}>{filter}</button>)}</div>
          </div>
          <div className="gallery-grid">
            {filteredProjects.map((project, index) => (
              <article className={`gallery-card ${index === 0 ? 'featured' : ''}`} key={project.title} data-reveal>
                <img src={project.image} alt={`${project.title} placeholder`} />
                <div className="gallery-overlay"><span>{project.category}</span><h3>{project.title}</h3><p>{project.meta}</p></div>
              </article>
            ))}
          </div>
          <div className="placeholder-notice"><Icon name="camera"/><span><strong>Portfolio images are placeholders.</strong> Replace files inside <code>public/images</code> later without changing the layout.</span></div>
        </section>

        <section className="industries-section">
          <div className="section industries-inner">
            <div data-reveal><p className="eyebrow light">Built for your environment</p><h2>Experience designed around commercial decision-makers.</h2></div>
            <div className="industry-list" data-reveal>
              {['General contractors', 'Multifamily & condominiums', 'Hospitality & resorts', 'Industrial properties', 'Municipal & institutional', 'Property management groups'].map((industry, index) => <div key={industry}><span>{String(index + 1).padStart(2, '0')}</span><strong>{industry}</strong><Icon name="chevron" /></div>)}
            </div>
          </div>
        </section>

        <section className="section testimonial-section">
          <div className="testimonial-label"><p className="eyebrow">What the experience should feel like</p><span>{String(activeTestimonial + 1).padStart(2, '0')} / 03</span></div>
          <div className="quote-mark">“</div>
          <blockquote key={activeTestimonial}>{testimonials[activeTestimonial].quote}</blockquote>
          <div className="testimonial-footer"><div><strong>{testimonials[activeTestimonial].name}</strong><span>{testimonials[activeTestimonial].role}</span></div><div className="testimonial-dots">{testimonials.map((_, index) => <button aria-label={`Show testimonial ${index + 1}`} className={index === activeTestimonial ? 'active' : ''} key={index} onClick={() => setActiveTestimonial(index)} />)}</div></div>
        </section>

        <section className="section faq-section">
          <div className="faq-title" data-reveal><p className="eyebrow">Questions</p><h2>Before you send the project.</h2><p>Start with what you know. The estimating workflow is designed to gather the rest.</p><button className="button button-primary" onClick={openQuote}>Start a request <Icon name="arrow" /></button></div>
          <div className="faq-list" data-reveal>{FAQS.map(([question, answer], index) => <article className={faqOpen === index ? 'open' : ''} key={question}><button onClick={() => setFaqOpen(faqOpen === index ? -1 : index)}><span>{question}</span><Icon name={faqOpen === index ? 'minus' : 'plus'} /></button><div><p>{answer}</p></div></article>)}</div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-pattern" aria-hidden="true" />
          <div className="contact-copy" data-reveal><p className="eyebrow light">Ready to move?</p><h2>Put the project in front of the right team.</h2><p>Send the scope now, or contact Gary directly for an active bid, urgent repair, or site issue.</p><button className="button button-accent" onClick={openQuote}>Request commercial pricing <Icon name="arrow" /></button></div>
          <div className="contact-card" data-reveal>
            <a href={`tel:${SITE.phoneHref}`}><Icon name="phone"/><span><small>Call</small><strong>{SITE.phoneDisplay}</strong></span><Icon name="chevron"/></a>
            <a href={`mailto:${SITE.email}`}><Icon name="mail"/><span><small>Email</small><strong>{SITE.email}</strong></span><Icon name="chevron"/></a>
            <div><Icon name="map"/><span><small>Service area</small><strong>{SITE.location}</strong></span></div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div><a className="brand footer-brand" href="#home"><span className="brand-mark"><i/><i/><i/></span><span><strong>{SITE.shortName}</strong><small>Commercial Rail & Fence</small></span></a><p>{SITE.tagline}</p></div>
          <div><strong>Navigate</strong>{navItems.map(([id, label]) => <button key={id} onClick={() => scrollTo(id)}>{label}</button>)}</div>
          <div><strong>Capabilities</strong>{SERVICES.map((service) => <button key={service.id} onClick={openQuote}>{service.title}</button>)}</div>
          <div><strong>Contact</strong><a href={`tel:${SITE.phoneHref}`}>{SITE.phoneDisplay}</a><a href={`mailto:${SITE.email}`}>{SITE.email}</a><span>{SITE.location}</span></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} {SITE.businessName}. Placeholder website version.</span><button onClick={openManager}>Manager login</button></div>
      </footer>
      <div className="mobile-cta"><a href={`tel:${SITE.phoneHref}`}><Icon name="phone"/>Call</a><button onClick={openQuote}>Request quote <Icon name="arrow"/></button></div>
    </div>
  );
}
