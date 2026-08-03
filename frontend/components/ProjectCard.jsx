import { useState, useEffect } from "react";
import { GitCommit, FolderOpen, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";

const ProjectCard = ({ project, index = 0 }) => {
  const status = project.status || "mvp";

  const statusConfig = {
    "mvp":         { color: "text-warning",   bg: "bg-warning/10",  border: "border-warning/20", dot: "bg-warning",   gradient: "from-rose-500 to-amber-500" },
    "development": { color: "text-primary",   bg: "bg-primary/10",  border: "border-primary/20", dot: "bg-primary",   gradient: "from-cyan-500 to-violet-500" },
    "production":  { color: "text-success",   bg: "bg-success/10",  border: "border-success/20", dot: "bg-success",   gradient: "from-emerald-500 to-cyan-500" },
    "archived":    { color: "text-text-muted", bg: "bg-bg-hover",   border: "border-border",     dot: "bg-text-muted", gradient: "from-gray-500 to-gray-600" },
  }[status] || { color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", dot: "bg-warning", gradient: "from-rose-500 to-amber-500" };

  const techStack = project.tech_stack || [];

  const created = project.created_at ? new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

  return (
    <Link href={`/project/${project.project_id || project._id}`} className="block group">
      <div
        className="glass-card glass-card-hover gradient-border rounded-2xl p-5 transition-all duration-300 cursor-pointer h-full flex flex-col justify-between hover:scale-[1.02] hover:-translate-y-0.5 animate-fadeIn"
        style={{ animationDelay: `${index * 80}ms` }}
      >
        {/* Gradient accent top bar */}
        <div className={`absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r ${statusConfig.gradient} rounded-full opacity-40 group-hover:opacity-80 transition-opacity duration-300`} />

        <div>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:shadow-[0_0_16px_var(--color-primary-glow)]"
                   style={{ background: 'var(--gradient-primary)' }}>
                <FolderOpen className="w-4 h-4 text-white" strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-primary transition-colors duration-200">
                {project.project_name}
              </h3>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1" />
          </div>

          <p className="text-xs text-text-muted mb-4 line-clamp-2 leading-relaxed">{project.description}</p>
          
          <div className="flex flex-wrap gap-1.5 mb-4">
            {techStack.slice(0, 4).map((tech, i) => (
              <span key={i} className="bg-bg-hover/50 border border-border text-text-secondary px-2.5 py-0.5 rounded-lg text-[10px] font-medium backdrop-blur-sm transition-colors duration-200 hover:border-primary/30 hover:text-primary">
                {typeof tech === "string" ? tech : (tech.name || tech.language || "")}
              </span>
            ))}
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-3 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[10px] text-text-muted">{project.total_commits || 0}</span>
            </div>
            {created && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-text-muted" />
                <span className="text-[10px] text-text-muted">{created}</span>
              </div>
            )}
          </div>
          
          <span className={`flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusConfig.color} ${statusConfig.bg} ${statusConfig.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} ${status === 'development' ? 'animate-dotPulse' : ''}`} />
            {status}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;
