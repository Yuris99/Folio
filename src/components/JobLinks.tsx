import type { Job } from '../types';
import { Icon } from './Icon';

function hostLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// 공고 원문과 노션은 가장 자주 여는 링크라 크게 보여 줍니다. 노션이 없으면 onAddNotion으로 바로 등록하게 합니다.
export function JobLinks({ job, size = 'md', onAddNotion }: { job: Pick<Job, 'url' | 'notionUrl'>; size?: 'md' | 'lg'; onAddNotion?: () => void }) {
  return <div className={`job-links job-links-${size}`}>
    {job.url
      ? <a className="job-link posting" href={job.url} target="_blank" rel="noreferrer"><Icon name="link" size={size === 'lg' ? 18 : 15} /><span><b>공고</b>{size === 'lg' && <small>{hostLabel(job.url)}</small>}</span><i aria-hidden="true">↗</i></a>
      : size === 'lg' ? <span className="job-link empty"><Icon name="link" size={18} /><span><b>공고 링크 없음</b><small>공고 편집에서 등록</small></span></span> : null}
    {job.notionUrl
      ? <a className="job-link notion" href={job.notionUrl} target="_blank" rel="noreferrer"><span className="notion-mark" aria-hidden="true">N</span><span><b>노션</b>{size === 'lg' && <small>{hostLabel(job.notionUrl)}</small>}</span><i aria-hidden="true">↗</i></a>
      : onAddNotion
        ? <button type="button" className="job-link add" onClick={onAddNotion} title="노션 링크 등록"><span className="notion-mark" aria-hidden="true">N</span><span><b>노션</b></span><i aria-hidden="true">+</i></button>
        : null}
  </div>;
}
