import { NavLink, useNavigate } from "react-router-dom";
import { Home, Download, LogOut, GraduationCap, PenLine, SquarePen } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/boards", label: "Home", icon: Home },
  { to: "/downloads", label: "Download", icon: Download },
  { to: "/offline-assessment", label: "Offline Assessment", icon: SquarePen }
];

export default function Sidebar() {

    const { logout } = useAuth();

    const navigate = useNavigate();
  
  const handleLogout = async () => {
  await logout();
  navigate("/");
};

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col items-center justify-between border-r-2 border-slate-200 bg-white py-6" style={{ padding: "0.3rem"}}>
      <div className="flex flex-col items-center gap-8 w-full">

        <div className="flex items-center gap-2" style={{ marginTop: "1rem"}}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-md">
          <GraduationCap className="h-5 w-5 text-white" strokeWidth={2.25} />
        </div>
        <p className="text-3xl font-bold">Knowe LMS</p>
        </div>


        <nav className="flex flex-col items-center gap-3 w-full">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex w-full items-center justify-start gap-1 rounded-md py-2.5 transition ${
                  isActive
                    ? "bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`
              }
              style={{ padding: "0.5rem" }}
            >
              <Icon className="h-5 w-5" strokeWidth={2.25} />
              <span className="text-[15px] font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

      </div>

      <button
        onClick={handleLogout}
        className="flex gap-2 w-full justify-center items-center gap-1 rounded-md text-white transition cursor-pointer bg-red-500 hover:bg-red-600"
        style={{ paddingTop: "0.6rem", paddingBottom: "0.6rem"}}
      >
        <LogOut className="h-5 w-5" strokeWidth={2.25} />
        <span className="text-[15px] font-medium">Logout</span>
      </button>
    </aside>
  );
}