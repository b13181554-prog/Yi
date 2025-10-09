async function getTelegramProfilePhoto(bot, userId) {
  try {
    const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
    
    if (!photos || !photos.photos || photos.photos.length === 0) {
      console.log(`ℹ️ User ${userId} has no profile photos`);
      return null;
    }
    
    const photo = photos.photos[0];
    if (!photo || photo.length === 0) {
      console.log(`ℹ️ User ${userId} profile photo array is empty`);
      return null;
    }
    
    const largestPhoto = photo[photo.length - 1];
    const fileId = largestPhoto.file_id;
    
    const fileLink = await bot.getFileLink(fileId);
    
    return fileLink;
  } catch (error) {
    console.error(`❌ Error getting Telegram profile photo for user ${userId}:`, error.message);
    return null;
  }
}

module.exports = {
  getTelegramProfilePhoto
};
