// src/integration/api-client.js - API client for React frontend
const API_BASE = '/api'; // Proxied by Vite to backend

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Health check
  async health() {
    return this.request('/health');
  }

  // Database test
  async dbTest() {
    return this.request('/db-test');
  }

  // Shows API
  async getShows(page = 1, pageSize = 10) {
    return this.request(`/shows?page=${page}&pageSize=${pageSize}`);
  }

  async createShow(showData) {
    return this.request('/shows', {
      method: 'POST',
      body: showData,
    });
  }

  async getShow(id) {
    return this.request(`/shows/${id}`);
  }

  async updateShow(id, showData) {
    return this.request(`/shows/${id}`, {
      method: 'PUT',
      body: showData,
    });
  }

  async deleteShow(id) {
    return this.request(`/shows/${id}`, {
      method: 'DELETE',
    });
  }
}

// Create and export a singleton instance
const api = new ApiClient();

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { api, ApiClient };
}

// For ES6 environments (this will work in React/Vite)
if (typeof window !== 'undefined') {
  window.api = api;
}

// Default export for ES6 imports
export { api, ApiClient };
export default api;