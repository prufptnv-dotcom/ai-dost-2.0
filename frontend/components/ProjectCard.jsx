import { useState, useEffect } from 'react';
import { AiOutlineFile } from 'react-icons/ai';
import { FaFire } from 'react-icons/fa';
import Link from 'next/link';

const ProjectCard = ({ project }) => {
  const [status, setStatus] = useState(project.status || 'mvp');
  
  useEffect(() => {
    if (project.status) {
      setStatus(project.status);
    }
  }, [project.status]);

  const statusColor = {
    'mvp': 'bg-warning/10 border-warning',
    'development': 'bg-primary/10 border-primary',
    'production': 'bg-success/10 border-success',
    'archived': 'bg-gray-400/10 border-gray-400'
  }[status] || 'bg-warning/10 border-warning';

  const techStack = project.tech_stack || [];

  return (
    <Link href={`/project/${project.project_id || project._id}`} className="block">
      <div className={`border p-6 rounded-xl hover:shadow-lg hover:shadow-primary/5 transition duration-300 ${statusColor} cursor-pointer h-full flex flex-col justify-between`}>
        <div>
          <h3 className="text-xl font-bold text-primary mb-2">{project.project_name}</h3>
          <p className="text-sm text-text-secondary mb-4 line-clamp-3">{project.description}</p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {techStack.map((tech, i) => (
              <span key={i} className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full text-xs font-semibold">
                {typeof tech === 'string' ? tech : (tech.name || tech.language || '')}
              </span>
            ))}
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-secondary/10">
          <div className="flex items-center space-x-2">
            <FaFire className="text-primary text-sm animate-pulse" />
            <span className="text-xs text-text-secondary">{project.total_commits || 0} commits</span>
          </div>
          
          <div className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-md">
            {status}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;
