// import { useNavigate } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext';

// const roleStyles = {
//   admin: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30',
//   member: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
// };

// export default function Navbar({ onAddMember }) {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();

//   const handleLogout = () => {
//     logout();
//     navigate('/login');
//   };

//   return (
//     <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
//       <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
//         <div>
//           <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Family Digital Vault</p>
//           <h1 className="mt-1 text-lg font-semibold text-white">Secure family archive</h1>
//         </div>

//         <div className="flex items-center gap-3">
//           {user ? (
//             <>
//               <div className="hidden text-right sm:block">
//                 <div className="text-sm font-semibold text-white">{user.name}</div>
//                 <div className="text-xs text-slate-400">{user.email}</div>
//               </div>
//               <span
//                 className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
//                   roleStyles[user.role] || roleStyles.member
//                 }`}
//               >
//                 {user.role || 'member'}
//               </span>
//               {user.role === 'admin' ? (
//                 <button
//                   type="button"
//                   onClick={onAddMember}
//                   className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
//                 >
//                   + Add Member
//                 </button>
//               ) : null}
//               <button
//                 type="button"
//                 onClick={handleLogout}
//                 className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
//               >
//                 Logout
//               </button>
//             </>
//           ) : null}
//         </div>
//       </div>
//     </header>
//   );
// }

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const roleStyles = {
  admin: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30',
  member: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
};

export default function Navbar({ onAddMember }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [familyMembers, setFamilyMembers] = useState([]);
  const [showFamily, setShowFamily] = useState(false);

  useEffect(() => {
    if (!user?.familyId) {
      setFamilyMembers([]);
      return;
    }

    api.get('/api/family/members')
      .then(({ data }) => setFamilyMembers(Array.isArray(data) ? data : []))
      .catch(() => setFamilyMembers([]));
  }, [user?.familyId]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Family Digital Vault</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Secure family archive</h1>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Family members toggle */}
              {user.familyId && familyMembers.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowFamily((v) => !v)}
                    className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
                  >
                    <span>Family</span>
                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
                      {familyMembers.length}
                    </span>
                  </button>

                  {showFamily && (
                    <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-xl">
                      <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Family members</p>
                      <div className="space-y-2">
                        {familyMembers.map((member) => (
                          <div key={member._id} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{member.name}</p>
                              <p className="truncate text-xs text-slate-400">@{member.username}</p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                                roleStyles[member.role] || roleStyles.member
                              }`}
                            >
                              {member.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold text-white">{user.name}</div>
                <div className="text-xs text-slate-400">{user.email}</div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  roleStyles[user.role] || roleStyles.member
                }`}
              >
                {user.role || 'member'}
              </span>
              {user.role === 'admin' ? (
                <button
                  type="button"
                  onClick={onAddMember}
                  className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
                >
                  + Add Member
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
