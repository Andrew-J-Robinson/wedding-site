function publicSettingsPayload(settings) {
    return {
      rsvpOpenGlobal: settings.rsvpOpenGlobal !== false,
      photos: settings.photos || {},
      party: settings.party || [],
      siteContent: settings.siteContent && typeof settings.siteContent === 'object' ? settings.siteContent : {},
    };
  }
  
  module.exports = { publicSettingsPayload };