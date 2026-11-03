import { useEffect, useState } from "react";
import { Mail, Phone, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./public-project-team.css";

type Member = {
  id: string; full_name: string; registration_number: string | null; university: string | null;
  faculty: string | null; programme: string | null; role_title: string; phone: string | null;
  email: string | null; bio: string | null; photo_path: string | null; display_order: number;
};
export default function PublicProjectTeam() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from("published_project_team").select("id,full_name,registration_number,university,faculty,programme,role_title,phone,email,bio,photo_path,display_order").order("display_order", { ascending: true });
      if (active && !error) setMembers((data ?? []) as Member[]);
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);
  return <section className="public-team-section"><div className="public-team-heading"><div><span className="section-eyebrow">THE PEOPLE BEHIND THE PROJECT</span><h2>Built by a team of people who care about privacy.</h2><p>Meet the contributors building a safer way to interact with generative AI.</p></div><span className="public-team-count">{members.length ? `${members.length} ${members.length === 1 ? "member" : "members"}` : "Project team"}</span></div>
    {loading ? <div className="public-team-empty">Loading project team…</div> : members.length ? <div className="public-team-grid">{members.map((member) => {
      const imageUrl = member.photo_path && supabase ? supabase.storage.from("guardai-team-avatars").getPublicUrl(member.photo_path).data.publicUrl : "";
      return <article className="public-team-card" key={member.id}><div className="public-team-photo">{imageUrl ? <img src={imageUrl} alt={`${member.full_name} portrait`} loading="lazy" /> : <span><UserRound size={38} /></span>}</div><div className="public-team-card-content"><span className="public-team-role">{member.role_title}</span><h3>{member.full_name}</h3>{member.bio && <p>{member.bio}</p>}<div className="public-team-details">{member.programme && <span>{member.programme}</span>}{member.university && <span>{member.university}</span>}{member.faculty && <span>{member.faculty}</span>}{member.registration_number && <span>Reg. {member.registration_number}</span>}{member.email && <a href={`mailto:${member.email}`}><Mail size={13} />{member.email}</a>}{member.phone && <a href={`tel:${member.phone}`}><Phone size={13} />{member.phone}</a>}</div></div></article>;
    })}</div> : <div className="public-team-empty">The project team profiles will appear here once published by the administrators.</div>}
  </section>;
}
