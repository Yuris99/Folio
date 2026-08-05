(function () {
  const config = window.FOLIO_CONFIG;

  class ApiError extends Error {
    constructor(message, status, details) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.details = details;
    }
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(`${config.apiBaseUrl}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
        signal: controller.signal
      });
      const body = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(body?.message || '요청을 처리하지 못했습니다.', response.status, body);
      return body?.data ?? body;
    } catch (error) {
      if (error.name === 'AbortError') throw new ApiError('서버 응답 시간이 초과되었습니다.', 408);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const remote = (path, options) => config.useMockBackend ? Promise.resolve(null) : request(path, options);

  const api = {
    isMock: config.useMockBackend,
    loginWithGoogle() {
      const returnTo = encodeURIComponent(location.href.split('#')[0]);
      location.href = `${config.apiBaseUrl}${config.googleLoginPath}?returnTo=${returnTo}`;
    },
    session: () => remote('/auth/session'),
    logout: () => remote('/auth/logout', { method: 'POST' }),
    bootstrap: () => remote('/bootstrap'),
    createApplication: payload => remote('/applications', { method: 'POST', body: JSON.stringify(payload) }),
    updateApplication: (id, payload) => remote(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteApplication: id => remote(`/applications/${id}`, { method: 'DELETE' }),
    createTask: payload => remote('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
    updateTask: (id, payload) => remote(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    createInterview: payload => remote('/interviews', { method: 'POST', body: JSON.stringify(payload) }),
    updateInterview: (id, payload) => remote(`/interviews/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteInterview: id => remote(`/interviews/${id}`, { method: 'DELETE' }),
    uploadFile: payload => remote('/files', { method: 'POST', body: JSON.stringify(payload) }),
    deleteFile: id => remote(`/files/${id}`, { method: 'DELETE' }),
    fileUrl: id => `${config.apiBaseUrl}/files/${id}`,
    resetWorkspace: () => remote('/workspace/reset', { method: 'POST' }),
    updateProfile: payload => remote('/profile', { method: 'PUT', body: JSON.stringify(payload) }),
    createCareerStory: payload => remote('/career-stories', { method: 'POST', body: JSON.stringify(payload) }),
    saveDocument: (id, payload) => remote(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    createDocument: payload => remote('/documents', { method: 'POST', body: JSON.stringify(payload) }),
    createJob: payload => remote('/jobs', { method: 'POST', body: JSON.stringify(payload) }),
    analyzeJob: payload => remote('/ai/jobs/analyze', { method: 'POST', body: JSON.stringify(payload) }),
    generateDocument: payload => remote('/ai/documents/generate', { method: 'POST', body: JSON.stringify(payload) })
  };

  window.folioApi = api;
  window.ApiError = ApiError;
})();
