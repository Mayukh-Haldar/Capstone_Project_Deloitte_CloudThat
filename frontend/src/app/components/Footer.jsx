import { Link } from "react-router";
import { Calendar, Mail, Phone, MapPin, Twitter, Linkedin, Github } from "lucide-react";
export function Footer() {
    const currentYear = new Date().getFullYear();
    return (<footer className="bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="size-8 bg-[#1132d4] rounded-xl flex items-center justify-center shadow-sm shadow-blue-700/20">
                <Calendar className="size-[18px] text-white"/>
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-foreground">EventZen</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The most powerful event management platform designed to orchestrate excellence and reimagine how you plan world-class experiences.
            </p>
            <div className="flex gap-3">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-accent hover:bg-accent/80 transition-[background-color]" aria-label="Twitter">
                <Twitter className="size-4 text-foreground"/>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-accent hover:bg-accent/80 transition-[background-color]" aria-label="LinkedIn">
                <Linkedin className="size-4 text-foreground"/>
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-accent hover:bg-accent/80 transition-[background-color]" aria-label="GitHub">
                <Github className="size-4 text-foreground"/>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/events" className="text-sm text-muted-foreground hover:text-foreground">
                  Events
                </Link>
              </li>
              <li>
                <Link to="/customer/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/my/tickets" className="text-sm text-muted-foreground hover:text-foreground">
                  My Tickets
                </Link>
              </li>
              <li>
                <Link to="/vendor/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                  Vendor Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Resources</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  API Documentation
                </a>
              </li>
              <li>
                <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
                  Sitemap
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Mail className="size-4 text-muted-foreground mt-0.5 flex-shrink-0"/>
                <a href="mailto:contact@eventzen.com" className="text-sm text-muted-foreground hover:text-foreground">
                  contact@eventzen.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="size-4 text-muted-foreground mt-0.5 flex-shrink-0"/>
                <a href="tel:+1234567890" className="text-sm text-muted-foreground hover:text-foreground">
                  +1 (234) 567-890
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="size-4 text-muted-foreground mt-0.5 flex-shrink-0"/>
                <span className="text-sm text-muted-foreground">
                  123 Event Street<br />
                  San Francisco, CA 94102
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} EventZen. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>);
}
