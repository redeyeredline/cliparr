// src/integration/api-client.js - API client for React frontend
import axios from 'axios';

const API_BASE = 'http://localhost:8485';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API request failed:', error);
    return Promise.reject(error);
  },
);

class ApiClient {
  // Health endpoints
  async checkHealth() {
    const response = await api.get('/health/status');
    return response.data;
  }

  async testDatabase() {
    const response = await api.get('/health/db-test');
    return response.data;
  }

  // Shows endpoints
  async getShows() {
    const response = await api.get('/shows');
    return response.data;
  }

  async getImportedShows() {
    const response = await api.get('/shows');
    return response.data.shows;
  }

  async getShow(id) {
    const response = await api.get(`/shows/${id}`);
    return response.data;
  }

  async createShow(showData) {
    const response = await api.post('/shows', showData);
    return response.data;
  }

  async updateShow(id, showData) {
    const response = await api.put(`/shows/${id}`, showData);
    return response.data;
  }

  async deleteShow(id) {
    const response = await api.delete(`/shows/${id}`);
    return response.data;
  }

  // Sonarr endpoints
  async getUnimportedShows() {
    const response = await api.get('/sonarr/unimported');
    return response.data;
  }

  async importShow(sonarrId) {
    const response = await api.post(`/sonarr/import/${sonarrId}`);
    return response.data;
  }

  async getSeriesDetails(sonarrId) {
    const response = await api.get(`/sonarr/series/${sonarrId}`);
    return response.data;
  }

  async getEpisodes(sonarrId) {
    const response = await api.get(`/sonarr/series/${sonarrId}/episodes`);
    return response.data;
  }

  async importShows(showIds) {
    const response = await api.post('/sonarr/import', { showIds });
    return response.data;
  }

  // Settings endpoints
  async getImportMode() {
    const response = await api.get('/settings/import-mode');
    return response.data;
  }

  async setImportMode(mode) {
    const response = await api.post('/settings/import-mode', { mode });
    return response.data;
  }

  async getPollingInterval() {
    const response = await api.get('/settings/polling-interval');
    return response.data;
  }

  async setPollingInterval(interval) {
    const response = await api.post('/settings/polling-interval', { interval });
    return response.data;
  }

  async deleteShows(ids) {
    const response = await api.post('/shows/delete', { ids });
    return response.data;
  }
}

export const apiClient = new ApiClient();
